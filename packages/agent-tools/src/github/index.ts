import { ToolsetDefinition } from '@refly/openapi-schema';

export const GitHubToolsetDefinition: ToolsetDefinition = {
  key: 'github',
  domain: 'https://github.com',
  labelDict: {
    en: 'GitHub',
    'zh-CN': 'GitHub',
  },
  descriptionDict: {
    en: 'Interact with GitHub API to manage repositories, issues, pull requests, and more.',
    'zh-CN': '与 GitHub API 交互，管理仓库、议题、拉取请求等。',
  },
  tools: [
    {
      name: 'accept_repository_invitation',
      descriptionDict: {
        en: 'Accept a repository invitation',
        'zh-CN': '接受仓库邀请',
      },
    },
    {
      name: 'star_repository',
      descriptionDict: {
        en: 'Star a repository for the authenticated user',
        'zh-CN': '为已认证用户标星仓库',
      },
    },
    {
      name: 'list_stargazers',
      descriptionDict: {
        en: 'List users who starred a repository',
        'zh-CN': '列出标星仓库的用户',
      },
    },
    {
      name: 'add_repository_collaborator',
      descriptionDict: {
        en: 'Add a user as a repository collaborator',
        'zh-CN': '将用户添加为仓库协作者',
      },
    },
    {
      name: 'add_assignees_to_issue',
      descriptionDict: {
        en: 'Add assignees to an issue',
        'zh-CN': '为议题添加负责人',
      },
    },
    {
      name: 'add_labels_to_issue',
      descriptionDict: {
        en: 'Add labels to an issue',
        'zh-CN': '为议题添加标签',
      },
    },
  ],
  requiresAuth: true,
  authPatterns: [
    {
      type: 'oauth',
      provider: 'github',
      scope: ['repo', 'user', 'admin:org'],
    },
  ],
  configItems: [],
};

// export interface GitHubParams extends ToolParams {
//   accessToken: string;
// }

// // Helper function to make GitHub API requests
// async function makeGitHubRequest(
//   method: string,
//   endpoint: string,
//   params: GitHubParams,
//   data?: any,
// ): Promise<any> {
//   const url = `https://api.github.com${endpoint}`;

//   const headers: Record<string, string> = {
//     'Authorization': `Bearer ${params.accessToken}`,
//     'Accept': 'application/vnd.github+json',
//     'X-GitHub-Api-Version': '2022-11-28',
//     'Content-Type': 'application/json',
//   };

//   const options: RequestInit = {
//     method,
//     headers,
//   };

//   if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
//     options.body = JSON.stringify(data);
//   }

//   const response = await fetch(url, options);

//   if (!response.ok) {
//     const errorData = await response.json().catch(() => ({}));
//     throw new Error(
//       `GitHub API error: ${response.status} ${response.statusText} - ${errorData?.message || 'Unknown error'}`,
//     );
//   }

//   // Some endpoints return 204 No Content
//   if (response.status === 204) {
//     return null;
//   }

//   return response.json();
// }

// export class GitHubAcceptRepositoryInvitation extends AgentBaseTool<GitHubParams> {
//   name = 'accept_repository_invitation';
//   toolsetKey = GitHubToolsetDefinition.key;

//   schema = z.object({
//     invitation_id: z.number().describe('Unique identifier of the repository invitation'),
//   });

//   description = 'Accepts a PENDING repository invitation that has been issued to the authenticated user.';

//   protected params: GitHubParams;

//   constructor(params: GitHubParams) {
//     super(params);
//     this.params = params;
//   }

//   async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
//     try {
//       await makeGitHubRequest(
//         'PATCH',
//         `/user/repository_invitations/${input.invitation_id}`,
//         this.params,
//       );

//       return {
//         status: 'success',
//         data: { invitation_id: input.invitation_id },
//         summary: `Successfully accepted repository invitation #${input.invitation_id}`,
//       };
//     } catch (error) {
//       return {
//         status: 'error',
//         error: 'Error accepting repository invitation',
//         summary: error instanceof Error ? error.message : 'Unknown error occurred',
//       };
//     }
//   }
// }

// export class GitHubStarRepository extends AgentBaseTool<GitHubParams> {
//   name = 'star_repository';
//   toolsetKey = GitHubToolsetDefinition.key;

//   schema = z.object({
//     owner: z.string().describe('The username of the account that owns the repository'),
//     repo: z.string().describe('The name of the repository, without the .git extension'),
//   });

//   description = 'Stars a repository for the authenticated user.';

//   protected params: GitHubParams;

//   constructor(params: GitHubParams) {
//     super(params);
//     this.params = params;
//   }

//   async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
//     try {
//       await makeGitHubRequest(
//         'PUT',
//         `/user/starred/${input.owner}/${input.repo}`,
//         this.params,
//       );

//       return {
//         status: 'success',
//         data: { owner: input.owner, repo: input.repo },
//         summary: `Successfully starred repository ${input.owner}/${input.repo}`,
//       };
//     } catch (error) {
//       return {
//         status: 'error',
//         error: 'Error starring repository',
//         summary: error instanceof Error ? error.message : 'Unknown error occurred',
//       };
//     }
//   }
// }

// export class GitHubListStargazers extends AgentBaseTool<GitHubParams> {
//   name = 'list_stargazers';
//   toolsetKey = GitHubToolsetDefinition.key;

//   schema = z.object({
//     owner: z.string().describe('Username of the repository owner'),
//     repo: z.string().describe('Name of the repository'),
//     page: z.number().optional().describe('Page number of results'),
//     per_page: z.number().optional().describe('Number of results per page (max 100)'),
//   });

//   description = 'Lists users who have starred a repository.';

//   protected params: GitHubParams;

//   constructor(params: GitHubParams) {
//     super(params);
//     this.params = params;
//   }

//   async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
//     try {
//       const params = new URLSearchParams();
//       if (input.page) params.set('page', input.page.toString());
//       if (input.per_page) params.set('per_page', input.per_page.toString());

//       const queryString = params.toString();
//       const endpoint = `/repos/${input.owner}/${input.repo}/stargazers${queryString ? `?${queryString}` : ''}`;

//       const stargazers = await makeGitHubRequest('GET', endpoint, this.params);

//       return {
//         status: 'success',
//         data: {
//           count: stargazers?.length ?? 0,
//           stargazers: stargazers?.map((user: any) => ({
//             login: user.login,
//             id: user.id,
//             avatar_url: user.avatar_url,
//             url: user.html_url,
//           })) ?? [],
//         },
//         summary: `Found ${stargazers?.length ?? 0} stargazers for ${input.owner}/${input.repo}`,
//       };
//     } catch (error) {
//       return {
//         status: 'error',
//         error: 'Error listing stargazers',
//         summary: error instanceof Error ? error.message : 'Unknown error occurred',
//       };
//     }
//   }
// }

// export class GitHubAddRepositoryCollaborator extends AgentBaseTool<GitHubParams> {
//   name = 'add_repository_collaborator';
//   toolsetKey = GitHubToolsetDefinition.key;

//   schema = z.object({
//     owner: z.string().describe('The account owner of the repository'),
//     repo: z.string().describe('The name of the repository'),
//     username: z.string().describe('The GitHub handle for the user account to add'),
//     permission: z
//       .enum(['pull', 'triage', 'push', 'maintain', 'admin'])
//       .optional()
//       .describe('Permission level for the collaborator'),
//   });

//   description = 'Adds a GitHub user as a repository collaborator.';

//   protected params: GitHubParams;

//   constructor(params: GitHubParams) {
//     super(params);
//     this.params = params;
//   }

//   async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
//     try {
//       const data = input.permission ? { permission: input.permission } : undefined;

//       await makeGitHubRequest(
//         'PUT',
//         `/repos/${input.owner}/${input.repo}/collaborators/${input.username}`,
//         this.params,
//         data,
//       );

//       return {
//         status: 'success',
//         data: {
//           owner: input.owner,
//           repo: input.repo,
//           username: input.username,
//           permission: input.permission ?? 'push',
//         },
//         summary: `Successfully added ${input.username} as collaborator to ${input.owner}/${input.repo}`,
//       };
//     } catch (error) {
//       return {
//         status: 'error',
//         error: 'Error adding collaborator',
//         summary: error instanceof Error ? error.message : 'Unknown error occurred',
//       };
//     }
//   }
// }

// export class GitHubAddAssigneesToIssue extends AgentBaseTool<GitHubParams> {
//   name = 'add_assignees_to_issue';
//   toolsetKey = GitHubToolsetDefinition.key;

//   schema = z.object({
//     owner: z.string().describe('The username of the account or organization'),
//     repo: z.string().describe('The name of the repository'),
//     issue_number: z.number().describe('The number identifying the issue'),
//     assignees: z.array(z.string()).describe('List of GitHub usernames to assign'),
//   });

//   description = 'Adds assignees to an issue.';

//   protected params: GitHubParams;

//   constructor(params: GitHubParams) {
//     super(params);
//     this.params = params;
//   }

//   async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
//     try {
//       const result = await makeGitHubRequest(
//         'POST',
//         `/repos/${input.owner}/${input.repo}/issues/${input.issue_number}/assignees`,
//         this.params,
//         { assignees: input.assignees },
//       );

//       return {
//         status: 'success',
//         data: {
//           issue_number: input.issue_number,
//           assignees: input.assignees,
//         },
//         summary: `Successfully added ${input.assignees.length} assignee(s) to issue #${input.issue_number}`,
//       };
//     } catch (error) {
//       return {
//         status: 'error',
//         error: 'Error adding assignees',
//         summary: error instanceof Error ? error.message : 'Unknown error occurred',
//       };
//     }
//   }
// }

// export class GitHubAddLabelsToIssue extends AgentBaseTool<GitHubParams> {
//   name = 'add_labels_to_issue';
//   toolsetKey = GitHubToolsetDefinition.key;

//   schema = z.object({
//     owner: z.string().describe('Username or organization name owning the repository'),
//     repo: z.string().describe('Repository name'),
//     issue_number: z.number().describe('Issue number'),
//     labels: z.array(z.string()).describe('List of label names to add'),
//   });

//   description = 'Adds labels to an issue.';

//   protected params: GitHubParams;

//   constructor(params: GitHubParams) {
//     super(params);
//     this.params = params;
//   }

//   async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
//     try {
//       const result = await makeGitHubRequest(
//         'POST',
//         `/repos/${input.owner}/${input.repo}/issues/${input.issue_number}/labels`,
//         this.params,
//         { labels: input.labels },
//       );

//       return {
//         status: 'success',
//         data: {
//           issue_number: input.issue_number,
//           labels: input.labels,
//         },
//         summary: `Successfully added ${input.labels.length} label(s) to issue #${input.issue_number}`,
//       };
//     } catch (error) {
//       return {
//         status: 'error',
//         error: 'Error adding labels',
//         summary: error instanceof Error ? error.message : 'Unknown error occurred',
//       };
//     }
//   }
// }

// export class GitHubToolset extends AgentBaseToolset<GitHubParams> {
//   toolsetKey = GitHubToolsetDefinition.key;
//   tools = [
//     GitHubAcceptRepositoryInvitation,
//     GitHubStarRepository,
//     GitHubListStargazers,
//     GitHubAddRepositoryCollaborator,
//     GitHubAddAssigneesToIssue,
//     GitHubAddLabelsToIssue,
//   ] satisfies readonly AgentToolConstructor<GitHubParams>[];
// }
