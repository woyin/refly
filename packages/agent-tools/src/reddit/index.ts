import { ToolsetDefinition } from '@refly/openapi-schema';

export const RedditToolsetDefinition: ToolsetDefinition = {
  key: 'reddit',
  domain: 'https://reddit.com',
  labelDict: {
    en: 'Reddit',
    'zh-CN': 'Reddit',
  },
  descriptionDict: {
    en: 'Interact with Reddit API to create posts, manage comments, search content, and more.',
    'zh-CN': '与 Reddit API 交互，创建帖子、管理评论、搜索内容等。',
  },
  tools: [
    {
      name: 'create_post',
      descriptionDict: {
        en: 'Create a new post on Reddit',
        'zh-CN': '在 Reddit 上创建新帖子',
      },
    },
    {
      name: 'delete_post',
      descriptionDict: {
        en: 'Delete a Reddit post',
        'zh-CN': '删除 Reddit 帖子',
      },
    },
    {
      name: 'post_comment',
      descriptionDict: {
        en: 'Post a comment on Reddit',
        'zh-CN': '在 Reddit 上发表评论',
      },
    },
    {
      name: 'delete_comment',
      descriptionDict: {
        en: 'Delete a Reddit comment',
        'zh-CN': '删除 Reddit 评论',
      },
    },
    {
      name: 'edit_comment_or_post',
      descriptionDict: {
        en: 'Edit a Reddit comment or post',
        'zh-CN': '编辑 Reddit 评论或帖子',
      },
    },
    {
      name: 'retrieve_post',
      descriptionDict: {
        en: 'Retrieve posts from a subreddit',
        'zh-CN': '从子版块检索帖子',
      },
    },
    {
      name: 'retrieve_post_comments',
      descriptionDict: {
        en: 'Retrieve comments for a post',
        'zh-CN': '检索帖子的评论',
      },
    },
    {
      name: 'search_subreddits',
      descriptionDict: {
        en: 'Search across subreddits',
        'zh-CN': '跨子版块搜索',
      },
    },
    {
      name: 'get_user_flair',
      descriptionDict: {
        en: 'Get available flairs for a subreddit',
        'zh-CN': '获取子版块可用的标签',
      },
    },
  ],
  requiresAuth: true,
  authPatterns: [
    {
      type: 'oauth',
      provider: 'reddit',
      scope: ['submit', 'edit', 'read', 'identity'],
    },
  ],
  configItems: [],
};

// export interface RedditParams extends ToolParams {
//   accessToken: string;
// }

// // Helper function to make Reddit API requests
// async function makeRedditRequest(
//   method: string,
//   endpoint: string,
//   params: RedditParams,
//   data?: any,
// ): Promise<any> {
//   const url = `https://oauth.reddit.com${endpoint}`;

//   const headers: Record<string, string> = {
//     'Authorization': `Bearer ${params.accessToken}`,
//     'User-Agent': 'Refly/1.0',
//   };

//   const options: RequestInit = {
//     method,
//     headers,
//   };

//   if (data) {
//     if (method === 'GET') {
//       // For GET requests, append data as query parameters
//       const queryParams = new URLSearchParams(data);
//       const finalUrl = `${url}?${queryParams.toString()}`;
//       const response = await fetch(finalUrl, options);

//       if (!response.ok) {
//         const errorData = await response.json().catch(() => ({}));
//         throw new Error(
//           `Reddit API error: ${response.status} ${response.statusText} - ${errorData?.message || 'Unknown error'}`,
//         );
//       }

//       return response.json();
//     } else {
//       // For POST/PUT requests, use form data
//       headers['Content-Type'] = 'application/x-www-form-urlencoded';
//       const formData = new URLSearchParams(data);
//       options.body = formData.toString();
//     }
//   }

//   const response = await fetch(url, options);

//   if (!response.ok) {
//     const errorData = await response.json().catch(() => ({}));
//     throw new Error(
//       `Reddit API error: ${response.status} ${response.statusText} - ${errorData?.message || 'Unknown error'}`,
//     );
//   }

//   return response.json();
// }

// export class RedditCreatePost extends AgentBaseTool<RedditParams> {
//   name = 'create_post';
//   toolsetKey = RedditToolsetDefinition.key;

//   schema = z.object({
//     subreddit: z.string().describe('The name of the subreddit (without r/ prefix)'),
//     title: z.string().describe('The title of the post (max 300 characters)'),
//     kind: z.enum(['link', 'self']).describe('Type of post: link or self (text)'),
//     text: z.string().optional().describe('Text content for self posts'),
//     url: z.string().optional().describe('URL for link posts'),
//     flair_id: z.string().optional().describe('Optional flair ID'),
//   });

//   description = 'Creates a new text or link post on a specified Reddit subreddit.';

//   protected params: RedditParams;

//   constructor(params: RedditParams) {
//     super(params);
//     this.params = params;
//   }

//   async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
//     try {
//       const postData: any = {
//         sr: input.subreddit,
//         title: input.title,
//         kind: input.kind,
//       };

//       if (input.kind === 'self' && input.text) {
//         postData.text = input.text;
//       } else if (input.kind === 'link' && input.url) {
//         postData.url = input.url;
//       }

//       if (input.flair_id) {
//         postData.flair_id = input.flair_id;
//       }

//       const result = await makeRedditRequest('POST', '/api/submit', this.params, postData);

//       return {
//         status: 'success',
//         data: {
//           url: result?.json?.data?.url,
//           id: result?.json?.data?.id,
//           name: result?.json?.data?.name,
//         },
//         summary: `Successfully created post in r/${input.subreddit}: "${input.title.substring(0, 50)}${input.title.length > 50 ? '...' : ''}"`,
//       };
//     } catch (error) {
//       return {
//         status: 'error',
//         error: 'Error creating Reddit post',
//         summary: error instanceof Error ? error.message : 'Unknown error occurred',
//       };
//     }
//   }
// }

// export class RedditDeletePost extends AgentBaseTool<RedditParams> {
//   name = 'delete_post';
//   toolsetKey = RedditToolsetDefinition.key;

//   schema = z.object({
//     id: z.string().describe('The full name (fullname) of the Reddit post to delete (starts with t3_)'),
//   });

//   description = 'Permanently deletes a Reddit post by its ID.';

//   protected params: RedditParams;

//   constructor(params: RedditParams) {
//     super(params);
//     this.params = params;
//   }

//   async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
//     try {
//       await makeRedditRequest('POST', '/api/del', this.params, { id: input.id });

//       return {
//         status: 'success',
//         data: { id: input.id },
//         summary: `Successfully deleted Reddit post with ID: ${input.id}`,
//       };
//     } catch (error) {
//       return {
//         status: 'error',
//         error: 'Error deleting Reddit post',
//         summary: error instanceof Error ? error.message : 'Unknown error occurred',
//       };
//     }
//   }
// }

// export class RedditPostComment extends AgentBaseTool<RedditParams> {
//   name = 'post_comment';
//   toolsetKey = RedditToolsetDefinition.key;

//   schema = z.object({
//     thing_id: z
//       .string()
//       .describe('The ID of the parent post or comment (prefixed with t3_ or t1_)'),
//     text: z.string().describe('The raw Markdown text of the comment'),
//   });

//   description = 'Posts a comment on Reddit, replying to a post or another comment.';

//   protected params: RedditParams;

//   constructor(params: RedditParams) {
//     super(params);
//     this.params = params;
//   }

//   async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
//     try {
//       const result = await makeRedditRequest('POST', '/api/comment', this.params, {
//         thing_id: input.thing_id,
//         text: input.text,
//       });

//       return {
//         status: 'success',
//         data: {
//           thing_id: input.thing_id,
//           comment_id: result?.json?.data?.things?.[0]?.data?.id,
//         },
//         summary: `Successfully posted comment on ${input.thing_id}`,
//       };
//     } catch (error) {
//       return {
//         status: 'error',
//         error: 'Error posting comment',
//         summary: error instanceof Error ? error.message : 'Unknown error occurred',
//       };
//     }
//   }
// }

// export class RedditDeleteComment extends AgentBaseTool<RedditParams> {
//   name = 'delete_comment';
//   toolsetKey = RedditToolsetDefinition.key;

//   schema = z.object({
//     id: z.string().describe('The full thing ID (fullname) of the comment to delete (starts with t1_)'),
//   });

//   description = 'Deletes a Reddit comment by its fullname ID.';

//   protected params: RedditParams;

//   constructor(params: RedditParams) {
//     super(params);
//     this.params = params;
//   }

//   async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
//     try {
//       await makeRedditRequest('POST', '/api/del', this.params, { id: input.id });

//       return {
//         status: 'success',
//         data: { id: input.id },
//         summary: `Successfully deleted comment with ID: ${input.id}`,
//       };
//     } catch (error) {
//       return {
//         status: 'error',
//         error: 'Error deleting comment',
//         summary: error instanceof Error ? error.message : 'Unknown error occurred',
//       };
//     }
//   }
// }

// export class RedditEditCommentOrPost extends AgentBaseTool<RedditParams> {
//   name = 'edit_comment_or_post';
//   toolsetKey = RedditToolsetDefinition.key;

//   schema = z.object({
//     thing_id: z
//       .string()
//       .describe('The full name (fullname) of the comment or post to edit (t1_ or t3_)'),
//     text: z.string().describe('The new raw markdown text for the body'),
//   });

//   description = "Edits the body text of the authenticated user's own comment or self-post.";

//   protected params: RedditParams;

//   constructor(params: RedditParams) {
//     super(params);
//     this.params = params;
//   }

//   async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
//     try {
//       await makeRedditRequest('POST', '/api/editusertext', this.params, {
//         thing_id: input.thing_id,
//         text: input.text,
//       });

//       return {
//         status: 'success',
//         data: { thing_id: input.thing_id },
//         summary: `Successfully edited ${input.thing_id}`,
//       };
//     } catch (error) {
//       return {
//         status: 'error',
//         error: 'Error editing comment or post',
//         summary: error instanceof Error ? error.message : 'Unknown error occurred',
//       };
//     }
//   }
// }

// export class RedditRetrievePost extends AgentBaseTool<RedditParams> {
//   name = 'retrieve_post';
//   toolsetKey = RedditToolsetDefinition.key;

//   schema = z.object({
//     subreddit: z.string().describe('The name of the subreddit (without r/ prefix)'),
//     size: z.number().optional().describe('Maximum number of posts to return (default: 5)'),
//   });

//   description = 'Retrieves the current hot posts from a specified subreddit.';

//   protected params: RedditParams;

//   constructor(params: RedditParams) {
//     super(params);
//     this.params = params;
//   }

//   async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
//     try {
//       const limit = input.size ?? 5;
//       const result = await makeRedditRequest(
//         'GET',
//         `/r/${input.subreddit}/hot`,
//         this.params,
//         { limit: limit.toString() },
//       );

//       const posts = result?.data?.children ?? [];

//       return {
//         status: 'success',
//         data: {
//           count: posts.length,
//           posts: posts.map((post: any) => ({
//             id: post?.data?.id,
//             title: post?.data?.title,
//             author: post?.data?.author,
//             score: post?.data?.score,
//             url: post?.data?.url,
//             created_utc: post?.data?.created_utc,
//           })),
//         },
//         summary: `Retrieved ${posts.length} posts from r/${input.subreddit}`,
//       };
//     } catch (error) {
//       return {
//         status: 'error',
//         error: 'Error retrieving posts',
//         summary: error instanceof Error ? error.message : 'Unknown error occurred',
//       };
//     }
//   }
// }

// export class RedditRetrievePostComments extends AgentBaseTool<RedditParams> {
//   name = 'retrieve_post_comments';
//   toolsetKey = RedditToolsetDefinition.key;

//   schema = z.object({
//     article: z.string().describe('Base-36 ID of the Reddit post (without t3_ prefix)'),
//   });

//   description = 'Retrieves all comments for a Reddit post.';

//   protected params: RedditParams;

//   constructor(params: RedditParams) {
//     super(params);
//     this.params = params;
//   }

//   async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
//     try {
//       const result = await makeRedditRequest(
//         'GET',
//         `/comments/${input.article}`,
//         this.params,
//       );

//       // Reddit returns an array where [0] is the post, [1] is comments
//       const comments = result?.[1]?.data?.children ?? [];

//       return {
//         status: 'success',
//         data: {
//           count: comments.length,
//           comments: comments.map((comment: any) => ({
//             id: comment?.data?.id,
//             author: comment?.data?.author,
//             body: comment?.data?.body,
//             score: comment?.data?.score,
//             created_utc: comment?.data?.created_utc,
//           })),
//         },
//         summary: `Retrieved ${comments.length} comments for post ${input.article}`,
//       };
//     } catch (error) {
//       return {
//         status: 'error',
//         error: 'Error retrieving comments',
//         summary: error instanceof Error ? error.message : 'Unknown error occurred',
//       };
//     }
//   }
// }

// export class RedditSearchSubreddits extends AgentBaseTool<RedditParams> {
//   name = 'search_subreddits';
//   toolsetKey = RedditToolsetDefinition.key;

//   schema = z.object({
//     search_query: z.string().describe('The search query string'),
//     limit: z.number().optional().describe('Maximum number of results (max 100)'),
//     sort: z
//       .enum(['relevance', 'new', 'top', 'comments'])
//       .optional()
//       .describe('Sort criterion'),
//     restrict_sr: z
//       .boolean()
//       .optional()
//       .describe('Confine search to subreddits if true'),
//   });

//   description = 'Searches Reddit for content using a query.';

//   protected params: RedditParams;

//   constructor(params: RedditParams) {
//     super(params);
//     this.params = params;
//   }

//   async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
//     try {
//       const queryParams: any = {
//         q: input.search_query,
//         limit: (input.limit ?? 5).toString(),
//         sort: input.sort ?? 'relevance',
//       };

//       if (input.restrict_sr !== undefined) {
//         queryParams.restrict_sr = input.restrict_sr.toString();
//       }

//       const result = await makeRedditRequest('GET', '/search', this.params, queryParams);

//       const results = result?.data?.children ?? [];

//       return {
//         status: 'success',
//         data: {
//           count: results.length,
//           results: results.map((item: any) => ({
//             id: item?.data?.id,
//             title: item?.data?.title,
//             subreddit: item?.data?.subreddit,
//             author: item?.data?.author,
//             score: item?.data?.score,
//             url: item?.data?.url,
//           })),
//         },
//         summary: `Found ${results.length} results for "${input.search_query}"`,
//       };
//     } catch (error) {
//       return {
//         status: 'error',
//         error: 'Error searching Reddit',
//         summary: error instanceof Error ? error.message : 'Unknown error occurred',
//       };
//     }
//   }
// }

// export class RedditGetUserFlair extends AgentBaseTool<RedditParams> {
//   name = 'get_user_flair';
//   toolsetKey = RedditToolsetDefinition.key;

//   schema = z.object({
//     subreddit: z.string().describe('Name of the subreddit to get flairs for'),
//   });

//   description = 'Fetches the list of available link flairs for a subreddit.';

//   protected params: RedditParams;

//   constructor(params: RedditParams) {
//     super(params);
//     this.params = params;
//   }

//   async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
//     try {
//       const result = await makeRedditRequest(
//         'GET',
//         `/r/${input.subreddit}/api/link_flair_v2`,
//         this.params,
//       );

//       const flairs = result ?? [];

//       return {
//         status: 'success',
//         data: {
//           count: flairs.length,
//           flairs: flairs.map((flair: any) => ({
//             id: flair?.id,
//             text: flair?.text,
//             type: flair?.type,
//           })),
//         },
//         summary: `Found ${flairs.length} available flairs for r/${input.subreddit}`,
//       };
//     } catch (error) {
//       return {
//         status: 'error',
//         error: 'Error getting flairs',
//         summary: error instanceof Error ? error.message : 'Unknown error occurred',
//       };
//     }
//   }
// }

// export class RedditToolset extends AgentBaseToolset<RedditParams> {
//   toolsetKey = RedditToolsetDefinition.key;
//   tools = [
//     RedditCreatePost,
//     RedditDeletePost,
//     RedditPostComment,
//     RedditDeleteComment,
//     RedditEditCommentOrPost,
//     RedditRetrievePost,
//     RedditRetrievePostComments,
//     RedditSearchSubreddits,
//     RedditGetUserFlair,
//   ] satisfies readonly AgentToolConstructor<RedditParams>[];
// }
