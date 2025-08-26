/**
 * Comprehensive prompt examples for variable extraction testing and reference
 * Organized by scenario and complexity level
 */
export const PROMPT_EXAMPLES = `## Reference Examples

### Travel Planning Examples

#### Complex Travel Planning
**Original Prompt**: 我计划端午去济州岛的偶来小路徒步，5月29号晚上杭州飞济州岛，5月30/31，6月1号2号四天徒步，想要获取100km证书，喜欢在海边徒步，请你帮我做规划（每天的徒步路线，住宿和饮食，以及装备）。以下信息同步给你： 1.我之前徒步每天早8点到晚上7点徒步，这个强度感觉不是很累，可以接受； 2.可以连续多日徒步；3.住宿期望单间，环境安静，条件好一些；4.饮食喜欢吃海鲜；5.节奏比较悠闲，最好有超美的风景拍照点；6.计划21和1号线一天， 5号线和6号线一天，7号线和8号线一天，9号线和10号线号线一天，帮我做一下规划（每天的起始点，住宿的酒店，吃饭的地方，路上的美景

**Extracted Variables**:
- destination (string): 济州岛 - Travel destination
- dates (string): 5月29号-6月2号 - Travel dates  
- departure_city (string): 杭州 - Departure city
- goal (string): 获取100km证书 - Travel goal
- accommodation (string): 单间，环境安静，条件好 - Accommodation preference
- food (string): 海鲜 - Food preference
- pace (string): 悠闲 - Travel pace
- daily_routes (string): 21和1号线一天，5号线和6号线一天，7号线和8号线一天，9号线和10号线一天 - Daily hiking routes

#### Simple Travel Planning
**Original Prompt**: 今年国庆想去马尔代夫潜水，大概5天，预算1万，想住水屋，最好能安排浮潜和出海。

**Extracted Variables**:
- destination (string): 马尔代夫 - Travel destination
- dates (string): 国庆 - Travel dates
- duration_days (string): 5天 - Travel duration
- budget (string): 1万 - Budget
- accommodation (string): 水屋 - Accommodation type
- activities (string): 潜水、浮潜、出海 - Planned activities

#### Complex Travel Planning (Extended)
**Original Prompt**: 我打算今年10月去马尔代夫度假，行程大概6天，预算一个人1.2万左右。希望能住2晚水屋、2晚沙滩别墅，重点体验浮潜和看海豚。如果能安排1天出海钓鱼更好。最好推荐拍照好看的海滩和日落观景点。

**Extracted Variables**:
- destination (string): 马尔代夫 - Travel destination
- dates (string): 今年10月 - Travel dates
- duration_days (string): 6天 - Travel duration
- budget (string): 1.2万 - Budget
- accommodation (string): 2晚水屋、2晚沙滩别墅 - Accommodation details
- activities (string): 浮潜、看海豚、出海钓鱼 - Planned activities

### Writing Task Examples

#### Simple Writing Task
**Original Prompt**: 帮我写一篇LinkedIn帖子，主题是AI对产品经理的影响，要简短、有洞见，目标读者是海外的产品经理。

**Extracted Variables**:
- topic (string): AI对产品经理的影响 - Article topic
- platform (string): LinkedIn - Publishing platform
- audience (string): 海外的产品经理 - Target audience
- length (string): 简短 - Content length
- tone (option): 有洞见 - Writing tone

#### Complex Writing Task
**Original Prompt**: 帮我写一篇微信公众号文章，主题是"AI如何改变产品经理的工作方式"。文章长度大概2000字，语气希望专业但要有故事感，不要死板。目标读者是互联网行业的年轻从业者，希望能加入真实案例，比如AI在需求分析和用户调研里的应用。

**Extracted Variables**:
- topic (string): AI如何改变产品经理的工作方式 - Article topic
- platform (string): 微信公众号 - Publishing platform
- audience (string): 互联网行业的年轻从业者 - Target audience
- length (string): 2000字 - Content length
- tone (string): 专业但要有故事感，不要死板 - Writing tone

### Video Creation Examples

#### Simple Video Creation
**Original Prompt**: 我想做一个短视频，内容是健身打卡，时长1分钟，配乐要动感，字幕只要中文。

**Extracted Variables**:
- topic (string): 健身打卡 - Video topic
- duration (string): 1分钟 - Video duration
- style (option): 实拍 - Video style
- music (string): 动感配乐 - Background music
- subtitle (string): 中文 - Subtitle language

#### Complex Video Creation
**Original Prompt**: 我想做一个短视频，主题是"重庆夜景"，时长控制在90秒左右。画面风格要快节奏、有冲击力，最好用电子音乐。开头希望是解放碑航拍，字幕要有中英文双语，结尾有一句口号"山城不夜天"。

**Extracted Variables**:
- topic (string): 重庆夜景 - Video topic
- duration (string): 90秒 - Video duration
- style (string): 快节奏、有冲击力 - Video style
- music (string): 电子音乐 - Background music
- subtitle (string): 中英文双语 - Subtitle language

### Data Analysis Examples

#### Simple Data Analysis
**Original Prompt**: 请帮我分析一下我们Q2的销售数据，重点对比Q1和Q2的GMV变化，输出一份带图表的简报。

**Extracted Variables**:
- data_file (resource): Q2销售数据 - Data source file
- timeframe (string): Q1和Q2 - Analysis timeframe
- metrics (string): GMV变化 - Key metrics to analyze
- deliverable (string): 带图表的简报 - Expected output format

#### Complex Data Analysis
**Original Prompt**: 请帮我分析我们电商平台Q2的销售数据，重点对比Q1和Q2的GMV变化，并拆分到各个品类。最好输出带图表的简报，指出增长最快的前3个品类和下滑最大的前2个品类。最后给2条优化建议。

**Extracted Variables**:
- data_file (resource): 电商平台Q2销售数据 - Data source file
- timeframe (string): Q1和Q2 - Analysis timeframe
- metrics (string): GMV变化、品类拆分、增长最快前3个品类、下滑最大前2个品类 - Key metrics to analyze
- deliverable (string): 带图表的简报、2条优化建议 - Expected output format

### Health Plan Examples

#### Simple Health Plan
**Original Prompt**: 我想要一个减脂的饮食和运动计划，早餐可以吃燕麦，中午鸡胸肉，运动每周跑步3次，每次30分钟。

**Extracted Variables**:
- goal (string): 减脂 - Health goal
- diet (string): 早餐燕麦，中午鸡胸肉 - Diet plan
- exercise (string): 跑步 - Exercise type
- frequency (string): 每周3次 - Exercise frequency
- duration (string): 每次30分钟 - Exercise duration

#### Complex Health Plan
**Original Prompt**: 我最近开始健身，目标是减脂+保持肌肉，想要一份饮食和运动计划。早餐我喜欢吃燕麦和鸡蛋，中午能接受鸡胸肉或牛肉，晚上最好清淡一些。每周安排3次跑步，每次30分钟，外加2次力量训练，器械为主。希望计划能兼顾减脂和肌肉维持，饮食最好简单易做。

**Extracted Variables**:
- goal (string): 减脂+保持肌肉 - Health goal
- diet (string): 早餐燕麦和鸡蛋，中午鸡胸肉或牛肉，晚上清淡 - Diet plan
- exercise (string): 3次跑步，2次力量训练 - Exercise plan
- frequency (string): 每周5次 - Exercise frequency
- duration (string): 跑步每次30分钟 - Exercise duration
- preference (string): 器械为主，简单易做 - Exercise and diet preferences`;
