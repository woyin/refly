import { Injectable, Logger } from '@nestjs/common';
import { Response } from 'express';

import { Prisma, ChatMessage, User, Conversation } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { CreateChatMessageInput, CreateConversationParam } from './conversation.dto';

import {
  QUICK_ACTION_TASK_PAYLOAD,
  QUICK_ACTION_TYPE,
  TASK_TYPE,
  Task,
  TaskResponse,
} from './conversation.dto';
import { createLLMChatMessage } from '../llm/schema';
import { LlmService } from '../llm/llm.service';
import { WeblinkService } from '../weblink/weblink.service';
import { IterableReadableStream } from '@langchain/core/dist/utils/stream';
import { BaseMessageChunk } from 'langchain/schema';
import { genConvID } from '../utils/id';
import { AigcService } from '../aigc/aigc.service';

const LLM_SPLIT = '__LLM_RESPONSE__';
const RELATED_SPLIT = '__RELATED_QUESTIONS__';

@Injectable()
export class ConversationService {
  private logger = new Logger(ConversationService.name);

  constructor(
    private prisma: PrismaService,
    private aigcService: AigcService,
    private weblinkService: WeblinkService,
    private llmService: LlmService,
  ) {}

  async createConversation(param: CreateConversationParam, user: User): Promise<Conversation> {
    const conversation = await this.prisma.conversation.create({
      data: {
        convId: genConvID(),
        title: param.title,
        origin: param.origin,
        originPageUrl: param.originPageUrl,
        originPageTitle: param.originPageTitle,
        userId: user.id,
      },
    });

    // Messages to initialize when creating this conversation
    const initMessages: CreateChatMessageInput[] = [];

    if (param.linkId) {
      const weblink = await this.weblinkService.findFirstWeblink({ linkId: param.linkId });
      const { summary, relatedQuestions } = weblink;
      initMessages.push(
        {
          type: 'human',
          content: getUserQuestion(QUICK_ACTION_TYPE.SUMMARY),
          sources: '[]',
          userId: user.id,
          conversationId: conversation.id,
          locale: param.locale,
        },
        {
          type: 'ai',
          content: summary,
          sources: JSON.stringify([
            {
              pageContent: '',
              metadata: JSON.parse(weblink.pageMeta),
            },
          ]),
          userId: user.id,
          conversationId: conversation.id,
          locale: param.locale,
          relatedQuestions: JSON.stringify(relatedQuestions),
        },
      );
    }

    // If this conversation is based on generated content
    // then initialize conversation messages with this content
    if (param.contentId) {
      const content = await this.aigcService.getContent({
        contentId: param.contentId,
      });
      initMessages.push(
        {
          type: 'human',
          content: content.title,
          sources: '[]',
          userId: user.id,
          conversationId: conversation.id,
          locale: param.locale,
        },
        {
          type: 'ai',
          content: content.content,
          sources: content.sources,
          userId: user.id,
          conversationId: conversation.id,
          locale: param.locale,
        },
      );
    }

    if (initMessages.length > 0) {
      await Promise.all([
        this.addChatMessages(initMessages),
        this.updateConversation(
          conversation.id,
          initMessages,
          {
            messageCount: { increment: 2 },
            lastMessage: initMessages[initMessages.length - 1].content,
          },
          param?.locale as LOCALE,
        ),
      ]);
    }

    return conversation;
  }

  async updateConversation(
    conversationId: number,
    messages: { type: string; content: string }[],
    data: Prisma.ConversationUpdateInput,
    locale: LOCALE,
  ) {
    const summarizedTitle = await this.llmService.summarizeConversation(messages, locale);
    this.logger.log(`Summarized title: ${summarizedTitle}`);

    return this.prisma.conversation.update({
      where: { id: conversationId },
      data: { ...data, title: summarizedTitle },
    });
  }

  async addChatMessages(msgList: CreateChatMessageInput[]) {
    return this.prisma.chatMessage.createMany({
      data: msgList,
    });
  }

  async findConversationById(id: number) {
    return this.prisma.conversation.findUnique({ where: { id } });
  }

  async findConversation(convId: string, withMessages = false) {
    const data = await this.prisma.conversation.findFirst({
      where: { convId },
      include: { messages: withMessages },
    });

    if (data && withMessages) {
      data.messages?.sort((a, b) => a.id - b.id);
    }

    return data;
  }

  async getConversations(params: {
    skip?: number;
    take?: number;
    cursor?: Prisma.ConversationWhereUniqueInput;
    where?: Prisma.ConversationWhereInput;
    orderBy?: Prisma.ConversationOrderByWithRelationInput;
  }) {
    return this.prisma.conversation.findMany({
      ...params,
    });
  }

  async getMessages(conversationId: number) {
    return this.prisma.chatMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async chat(res: Response, user: User, task: Task) {
    const { taskType, data = {}, conversation } = task;

    const query = data?.question || '';
    const weblinkList = data?.filter?.weblinkList || [];

    // 如果指定 URL 进行 chat，则异步进行保存
    if (weblinkList.length > 0) {
      this.weblinkService.storeLinks(
        user.id,
        weblinkList.map((weblink) => ({ url: weblink.metadata.source })),
      );
    }

    // 获取聊天历史
    const chatHistory = await this.getMessages(conversation.id);

    let taskRes: TaskResponse;
    if (taskType === TASK_TYPE.QUICK_ACTION) {
      taskRes = await this.handleQuickActionTask(res, user, task);
    } else if (taskType === TASK_TYPE.SEARCH_ENHANCE_ASK) {
      taskRes = await this.handleSearchEnhanceTask(res, task, chatHistory);
    } else {
      taskRes = await this.handleChatTask(res, user, task, chatHistory);
    }

    const newMessages: CreateChatMessageInput[] = [
      {
        type: 'human',
        userId: user.id,
        conversationId: conversation.id,
        content: query,
        sources: '',
        // 每次提问完在 human message 上加一个提问的 filter，这样之后追问时可以 follow 这个 filter 规则
        selectedWeblinkConfig: JSON.stringify({
          searchTarget: weblinkList?.length > 0 ? 'selectedPages' : 'all',
          filter: weblinkList,
        }),
      },
      {
        type: 'ai',
        userId: user.id,
        conversationId: conversation.id,
        content: taskRes.answer,
        sources: JSON.stringify(taskRes.sources),
        relatedQuestions: JSON.stringify(taskRes.relatedQuestions),
      },
    ];

    // post chat logic
    await Promise.all([
      this.addChatMessages(newMessages),
      this.updateConversation(
        conversation.id,
        [...chatHistory, ...newMessages],
        {
          lastMessage: taskRes.answer,
          messageCount: chatHistory.length + 2,
        },
        task?.locale,
      ),
    ]);
  }

  async handleChatTask(
    res: Response,
    user: User,
    task: Task,
    chatHistory: ChatMessage[],
  ): Promise<TaskResponse> {
    const locale = task.locale || (user.outputLocale as LOCALE) || LOCALE.EN;

    const { data = {} } = task;
    const { filter = {} } = data;
    const urls = filter.weblinkList?.map((item) => item?.metadata?.source);

    // 如果有 cssSelector，则代表从基于选中的内容进行提问，否则根据上下文进行相似度匹配召回
    const chatFromClientSelector = !!filter.weblinkList?.find(
      (item) => item?.selections?.length > 0,
    );
    this.logger.log(`chatFromClientSelector: ${chatFromClientSelector}, urls: ${urls}`);

    // 前置的数据处理
    const query = task?.data?.question;
    const llmChatMessages = chatHistory
      ? chatHistory.map((msg) => createLLMChatMessage(msg.content, msg.type))
      : [];

    // 如果是基于选中内容提问的话，则不需要考虑上下文
    const questionWithContext =
      chatHistory.length <= 1 || chatFromClientSelector
        ? query
        : await this.llmService.getContextualQuestion(query, locale, llmChatMessages);
    this.logger.log(`questionWithContext: ${questionWithContext}`);

    const docs = chatFromClientSelector
      ? await this.weblinkService.readMultiWeblinks(task?.data?.filter?.weblinkList)
      : await this.llmService.getRetrievalDocs(user, questionWithContext, urls);

    const { stream } = await this.llmService.chat(
      questionWithContext,
      locale,
      llmChatMessages,
      docs,
    );

    // first return sources，use unique tag for parse data
    res.write(JSON.stringify(docs));
    res.write(LLM_SPLIT);

    const getSSEData = async (stream) => {
      // write answer in a stream style
      let answerStr = '';
      for await (const chunk of await stream) {
        answerStr += chunk || '';

        res.write(chunk || '');
      }

      return answerStr;
    };

    const [answerStr, relatedQuestions] = await Promise.all([
      getSSEData(stream),
      this.llmService.getRelatedQuestion(docs, questionWithContext, locale),
    ]);

    this.logger.log('relatedQuestions', relatedQuestions);

    res.write(RELATED_SPLIT);

    if (relatedQuestions) {
      res.write(JSON.stringify(relatedQuestions) || '');
    }
    res.end(``);

    return {
      sources: docs,
      answer: answerStr,
      relatedQuestions,
    };
  }

  async handleSearchEnhanceTask(
    res: Response,
    task: Task,
    chatHistory: ChatMessage[],
  ): Promise<TaskResponse> {
    const query = task?.data?.question;
    const locale = task?.locale || LOCALE.EN;
    const { stream, sources } = await this.llmService.searchEnhance(
      query,
      locale,
      chatHistory ? chatHistory.map((msg) => createLLMChatMessage(msg.content, msg.type)) : [],
    );

    // first return sources，use unique tag for parse data
    res.write(JSON.stringify(sources) || '');
    res.write(LLM_SPLIT);

    const getSSEData = async (stream) => {
      // write answer in a stream style
      let answerStr = '';
      for await (const chunk of await stream) {
        const chunkStr = chunk?.content || (typeof chunk === 'string' ? chunk : '');
        answerStr += chunkStr || '';

        res.write(chunkStr || '');
      }

      return answerStr;
    };

    const [answerStr, relatedQuestions] = await Promise.all([
      getSSEData(stream),
      this.llmService.getRelatedQuestion(sources, query, locale),
    ]);

    this.logger.log('relatedQuestions', relatedQuestions);

    res.write(RELATED_SPLIT);
    res.write(JSON.stringify(relatedQuestions) || '');
    res.end(``);

    const handledAnswer = answerStr
      .replace(/\[\[([cC])itation/g, '[citation')
      .replace(/[cC]itation:(\d+)]]/g, 'citation:$1]')
      .replace(/\[\[([cC]itation:\d+)]](?!])/g, `[$1]`)
      .replace(/\[[cC]itation:(\d+)]/g, '[citation]($1)');
    this.logger.log('handledAnswer', handledAnswer);

    return {
      sources,
      // 支持做 citation 的处理
      answer: handledAnswer,
      relatedQuestions,
    };
  }

  async handleQuickActionTask(res: Response, user: User, task: Task): Promise<TaskResponse> {
    const data = task?.data as QUICK_ACTION_TASK_PAYLOAD;
    const locale = task?.locale || LOCALE.EN;

    // first return sources，use unique tag for parse data
    // frontend return origin weblink meta
    const sources = data?.filter?.weblinkList || [];
    // TODO: 这里后续要处理边界情况，比如没有链接时应该报错
    if (sources?.length <= 0) {
      res.write(JSON.stringify([]));
      // 先发一个空块，提前展示 sources
      res.write(LLM_SPLIT);

      return {
        sources: [],
        answer: '',
      };
    }

    res.write(JSON.stringify(sources) || '');
    res.write(LLM_SPLIT);

    const weblinkList = data?.filter?.weblinkList;
    if (weblinkList?.length <= 0) return;

    // save user mark for each weblink in a non-blocking style
    this.weblinkService.saveWeblinkUserMarks({ userId: user.id, weblinkList });

    // 基于一组网页做总结，先获取网页内容
    const docs = await this.weblinkService.readMultiWeblinks(weblinkList);

    let stream: IterableReadableStream<BaseMessageChunk>;
    if (data?.actionType === QUICK_ACTION_TYPE.SUMMARY) {
      stream = await this.llmService.summary(data?.actionPrompt, locale, docs);
    }

    const getSSEData = async (stream) => {
      // write answer in a stream style
      let answerStr = '';
      for await (const chunk of await stream) {
        const chunkStr = chunk?.content || (typeof chunk === 'string' ? chunk : '');
        answerStr += chunkStr;

        res.write(chunkStr || '');
      }

      return answerStr;
    };

    const [answerStr, relatedQuestions] = await Promise.all([
      getSSEData(stream),
      this.llmService.getRelatedQuestion(docs, getUserQuestion(data?.actionType), locale),
    ]);

    this.logger.log('relatedQuestions', relatedQuestions);

    res.write(RELATED_SPLIT);
    res.write(JSON.stringify(relatedQuestions));
    res.end(``);

    return {
      sources,
      answer: answerStr,
      relatedQuestions,
    };
  }
}

const getUserQuestion = (actionType: QUICK_ACTION_TYPE) => {
  switch (actionType) {
    case QUICK_ACTION_TYPE.SUMMARY: {
      return '总结网页'; // TODO: 国际化
    }
  }
};
