6.3 执行
模块
描述
图示
执行前提
- Schedule 状态为 Active
- 系统到达该 Schedule 的 Next Run Time

执行前校验
-
会员定时任务数量校验

校验规则
- 校验当前账号已启用（Active）的定时任务数量
  - Free 用户：最多 1 个
  - Plus 用户：最多 20 个
异常处理
- 若已超过用户当前会员等级的定时任务上限（ Plus 取消订阅转为 Free ）：
  - 仅继续运行当前在启用状态下的，创建时间最早的 Schedule
  - 其他 Schedule 执行时，自动失败，并生成一条运行失败的 Runlog，并向用户发送【已超过定时任务数量上限】的邮件通知（邮件内容详见下文）


执行前校验
-
积分余额校验
校验规则
- 校验当前账号积分是否足够支持本次 Workflow 执行
异常处理
- 若积分不足：
  - 不再继续本次执行
  - 工作流状态不变
  - 生成一条运行失败的 Runlog
  - 向用户发送【已超过定时任务数量上限】的邮件通知（邮件内容详见下文）

执行结果处理与通知
执行成功
当 Workflow 中所有 Agent 节点均成功执行：
- 本次 Run 状态记录为 Success
- 写入 Run Log
- 向用户发送【定时任务运行成功】的邮件通知（邮件内容详见下文）
执行失败
当任一 Agent 节点执行失败：
- 本次 Run 状态记录为 Failed
- 写入 Run Log
- 向用户发送【定时任务运行失败】的邮件通知（邮件内容详见下文）
- Schedule 状态保持不变（仍为 Enabled），可继续参与下一次调度

邮件内容
-
已超过定时任务数量上限
Email Subject：Your scheduled workflow has been paused
Email Body
Hi {{User Name}},
Your scheduled workflow “{{Schedule Name}}” has been paused because you’ve reached the maximum number of active schedules allowed for your current plan.
What happened
- Your plan allows up to {{Limit}} active scheduled workflows
- You currently have {{Current Count}} active schedules
As a result, this schedule has been temporarily stopped and will not run until the issue is resolved.
What you can do
- Disable or delete an existing schedule from your Schedules page
- Or upgrade your plan to unlock more scheduled workflows
Once the number of active schedules is back within your plan limit, this schedule will automatically resume.
View and manage your schedules:
 👉 {{Schedules Link}}
— The Refly.ai Team


邮件内容
-
积分不足
Email Subject：Your scheduled workflow couldn’t run due to insufficient credits
Email Body
Hi {{User Name}},
Your scheduled workflow “{{Schedule Name}}” was unable to run because your account doesn’t have enough credits.
What happened
- The workflow requires credits to execute
- Your current credit balance is insufficient
- Next Scheduled Run: {{Next Run Time}} (This will only trigger if credits are available)
This schedule has been temporarily paused and will not run until your credits are replenished.
Once your credit balance is restored, the schedule will automatically resume and continue running as planned.
View and manage your schedules:
 👉 {{Schedules Link}}
— The Refly.ai  Team


邮件内容
-
定时任务运行成功
Email Subject：Scheduled workflow Succeeded successfully
Email Body
Hi {{User Name}},
Your scheduled workflow “{{Schedule Name}}” ran successfully.
Run details
- Status: Succeeded
- Run time: {{Run Time}}
- Next scheduled run: {{Next Run Time}}
You can view the full run details and results here:
 👉 {{Run Details Link}}
— The Refly.ai  Team

邮件内容
-
定时任务运行失败
Email Subject：Scheduled workflow failed to run
Email Body
Hi {{User Name}},
Your scheduled workflow “{{Schedule Name}}” failed during its most recent run.
Run details
- Status: Failed
- Run time: {{Run Time}}
- Next scheduled run: {{Next Run Time}}
The schedule itself is still active and will attempt to run again at the next scheduled time.
You can review the failure details and troubleshoot the workflow here:
 👉 {{Run Details Link}}
— The Refly.ai  Team


