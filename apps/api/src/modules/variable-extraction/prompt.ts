import { WorkflowVariable } from 'src/modules/variable-extraction/variable-extraction.dto';

export function buildVariableExtractionPrompt(
  userPrompt: string,
  existingVariables: WorkflowVariable[],
  canvasContext: any,
): string {
  const existingVarsText =
    existingVariables.length > 0
      ? existingVariables
          .map((v) => {
            const value = Array.isArray(v.value) ? v.value.join(', ') : v.value;
            return `- ${v.name} (${v.variableType}): ${v.description} [当前值: ${value || '空'}]`;
          })
          .join('\n')
      : '- 暂无现有变量';

  return `# AI 工作流变量智能提取专家

你是一个专业的工作流分析专家，负责从用户的自然语言输入中智能提取可参数化的变量，构建高效的工作流模板。

## 核心任务
1. **精准识别**: 分析用户输入，识别所有可变参数
2. **智能分类**: 将参数归类为 string/resource/option 三种类型
3. **变量复用**: 检测并复用现有变量，避免重复创建
4. **模板生成**: 生成带占位符的 processedPrompt 模板

## 输入上下文

### 用户原始输入
\`\`\`
${userPrompt}
\`\`\`

### 现有变量库
${existingVarsText}

### 工作流上下文
- 画布节点: ${canvasContext.nodeCount || 0} 个
- 工作流类型: ${canvasContext.workflowType || '通用工作流'}
- 主要技能: ${canvasContext.primarySkills?.join(', ') || '内容生成'}
- 复杂度评分: ${canvasContext.complexity || 1}/10

## 变量类型定义

### 1. string (文本变量)
- **用途**: 纯文本内容、配置参数、描述信息
- **示例**: 主题、标题、要求、风格、语言等
- **命名**: topic, title, style, language, requirement

### 2. resource (资源变量) 
- **用途**: 需要用户上传的文件、文档、图片等
- **示例**: 简历文件、参考文档、图片素材等
- **命名**: resume_file, reference_doc, source_image

### 3. option (选项变量)
- **用途**: 预定义的选择项、枚举值
- **示例**: 格式选择、模式选择、级别选择等
- **命名**: output_format, processing_mode, difficulty_level

## 智能分析流程

### Step 1: 意图理解
- 分析用户的核心目标和期望输出
- 识别任务类型和复杂程度

### Step 2: 实体抽取
- 扫描用户输入中的具体值和概念
- 判断哪些内容可以参数化
- 区分固定内容和可变内容

### Step 3: 变量分类
- string: 用户可直接输入的文本内容
- resource: 需要上传的文件或外部资源
- option: 有限选择集合中的选项

### Step 4: 复用检测
- 语义相似度匹配 (阈值 0.8+)
- 指代词检测 ("这个"、"上述"、"刚才的")
- 上下文关联分析

### Step 5: 变量命名
- 使用英文 snake_case 格式
- 名称要见名知意且简洁
- 避免与现有变量名冲突

### Step 6: 模板构建
- 将提取的变量值替换为 {{variable_name}} 占位符
- 保持原文语义和结构完整
- 确保模板可读性和实用性

## 输出格式要求

**必须**返回标准 JSON 格式，不允许有任何格式错误：

\`\`\`json
{
  "analysis": {
    "userIntent": "用户意图的简洁描述",
    "extractionConfidence": 0.95,
    "complexityScore": 3,
    "extractedEntityCount": 5,
    "variableTypeDistribution": {
      "string": 3,
      "resource": 1, 
      "option": 1
    }
  },
  "variables": [
    {
      "name": "variable_name",
      "value": ["具体提取的值或空字符串"],
      "description": "变量用途描述",
      "variableType": "string",
      "source": "startNode",
      "extractionReason": "为什么提取这个变量",
      "confidence": 0.92
    }
  ],
  "reusedVariables": [
    {
      "detectedText": "原文中被复用的文本片段",
      "reusedVariableName": "复用的变量名",
      "confidence": 0.89,
      "reason": "复用的具体原因"
    }
  ],
  "processedPrompt": "替换变量后的模板字符串，使用{{variable_name}}格式",
  "originalPrompt": "原始用户输入"
}
\`\`\`

### 示例
#### 用户输入
\`\`\`
根据提供的原始简历和目标岗位 JD，用英文重写一份面向 AI 产品经理岗位的简历，突出数据分析和跨部门协作能力，以简洁有力的语言量化成绩
\`\`\`

#### 输出示例
\`\`\`json
{
  "originalPrompt": "根据提供的原始简历和目标岗位 JD，用英文重写一份面向 AI 产品经理岗位的简历，突出数据分析和跨部门协作能力，以简洁有力的语言量化成绩",
  "processedPrompt": "根据提供的{{original_resume}}和{{target_position_jd}}，用{{language}}重写一份面向{{target_position}}岗位的简历，突出{{highlight_skills}}，以{{writing_style}}的语言量化成绩",
  "analysis": {
    "userIntent": "根据提供的原始简历和目标岗位 JD，用英文重写一份面向 AI 产品经理岗位的简历，突出数据分析和跨部门协作能力，以简洁有力的语言量化成绩",
    "extractionConfidence": 0.95,
    "complexityScore": 3
  },
  "variables": [
    {
      "name": "original_resume",
      "variableType": "resource",
      "value": ["file_storage_key_previous123"],  // 复用现有文件
      "description": "原始简历文件",
      "source": "startNode",
    },
    {
      "name": "job_type", 
      "variableType": "string",
      "value": ["AI 产品经理"],    // 更新变量值为"AI 产品经理"
      "description": "目标岗位名称",
      "source": "startNode",
    },
    {
      "name": "target_position_jd",
      "variableType": "resource",
      "value": [""],
      "description": "目标岗位JD文件",
      "source": "startNode"
    },
    {
      "name": "language",
      "variableType": "string",
      "value": ["英文"],
      "description": "简历语言要求",
      "source": "startNode"
    },
    {
      "name": "highlight_skills", 
      "variableType": "string",
      "value": ["数据分析和跨部门协作能力"],
      "description": "需要突出的技能",
      "source": "startNode"
    },
    {
      "name": "writing_style",
      "variableType": "string",
      "value": ["简洁有力"], 
      "description": "写作风格要求",
      "source": "startNode"
    }
  ]
}
  "reusedVariables": [
    {
      "detectedText": "原始简历",
      "reusedVariableName": "original_resume",
      "confidence": 0.95,
      "reason": "智能复用：检测到相同文件类型变量，节省重复上传",
    },
    {
      "detectedText": "AI 产品经理",
      "reusedVariableName": "target_position", 
      "confidence": 0.82,
      "reason": "智能更新：岗位概念升级，从'产品经理'细化为'AI 产品经理'",
    }
  ]
}
\`\`\`

## 质量标准
- 变量名称：清晰、一致、见名知意
- 变量类型：准确分类，符合三种类型定义
- 复用检测：高准确率，减少冗余变量
- 处理后模板：保持原意，正确替换占位符
    `;
}
