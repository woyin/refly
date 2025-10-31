import { ToolsetDefinition } from '@refly/openapi-schema';

export const LinkedInToolsetDefinition: ToolsetDefinition = {
  key: 'linkedin',
  domain: 'https://linkedin.com',
  labelDict: {
    en: 'LinkedIn',
    'zh-CN': 'LinkedIn',
  },
  descriptionDict: {
    en: 'Interact with LinkedIn API to create posts, manage company pages, and more.',
    'zh-CN': '与 LinkedIn API 交互，创建帖子、管理公司页面等。',
  },
  tools: [
    {
      name: 'create_post',
      descriptionDict: {
        en: 'Create a new post on LinkedIn',
        'zh-CN': '在 LinkedIn 上创建新帖子',
      },
    },
    {
      name: 'delete_post',
      descriptionDict: {
        en: 'Delete a LinkedIn post',
        'zh-CN': '删除 LinkedIn 帖子',
      },
    },
    {
      name: 'get_my_info',
      descriptionDict: {
        en: 'Get authenticated user profile information',
        'zh-CN': '获取已认证用户的个人资料信息',
      },
    },
    {
      name: 'get_company_info',
      descriptionDict: {
        en: 'Get organizations where user has specific roles',
        'zh-CN': '获取用户具有特定角色的组织',
      },
    },
  ],
  requiresAuth: true,
  authPatterns: [
    {
      type: 'oauth',
      provider: 'linkedin',
      scope: ['w_member_social', 'r_liteprofile', 'r_organization_social'],
    },
  ],
  configItems: [],
};

// export interface LinkedInParams extends ToolParams {
//   accessToken: string;
// }

// // Helper function to make LinkedIn API requests
// async function makeLinkedInRequest(
//   method: string,
//   endpoint: string,
//   params: LinkedInParams,
//   data?: any,
// ): Promise<any> {
//   const url = `https://api.linkedin.com/v2${endpoint}`;

//   const headers: Record<string, string> = {
//     'Authorization': `Bearer ${params.accessToken}`,
//     'Content-Type': 'application/json',
//     'X-Restli-Protocol-Version': '2.0.0',
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
//       `LinkedIn API error: ${response.status} ${response.statusText} - ${errorData?.message || 'Unknown error'}`,
//     );
//   }

//   // Some endpoints return 204 No Content
//   if (response.status === 204) {
//     return null;
//   }

//   return response.json();
// }

// export class LinkedInCreatePost extends AgentBaseTool<LinkedInParams> {
//   name = 'create_post';
//   toolsetKey = LinkedInToolsetDefinition.key;

//   schema = z.object({
//     author: z
//       .string()
//       .describe('The URN of the LinkedIn member or organization creating the post'),
//     commentary: z.string().describe('The main text content of the post'),
//     visibility: z
//       .enum(['PUBLIC', 'CONNECTIONS', 'LOGGED_IN', 'CONTAINER'])
//       .optional()
//       .describe('Controls who can see the post'),
//     lifecycleState: z
//       .enum(['PUBLISHED', 'DRAFT', 'PUBLISH_REQUESTED'])
//       .optional()
//       .describe('The state of the post'),
//     isReshareDisabledByAuthor: z
//       .boolean()
//       .optional()
//       .describe('Set to true to prevent others from resharing'),
//   });

//   description = 'Creates a new post on LinkedIn for the authenticated user or organization.';

//   protected params: LinkedInParams;

//   constructor(params: LinkedInParams) {
//     super(params);
//     this.params = params;
//   }

//   async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
//     try {
//       const postData = {
//         author: input.author,
//         lifecycleState: input.lifecycleState ?? 'PUBLISHED',
//         specificContent: {
//           'com.linkedin.ugc.ShareContent': {
//             shareCommentary: {
//               text: input.commentary,
//             },
//             shareMediaCategory: 'NONE',
//           },
//         },
//         visibility: {
//           'com.linkedin.ugc.MemberNetworkVisibility': input.visibility ?? 'PUBLIC',
//         },
//       };

//       if (input.isReshareDisabledByAuthor !== undefined) {
//         Object.assign(postData, {
//           isReshareDisabledByAuthor: input.isReshareDisabledByAuthor,
//         });
//       }

//       const result = await makeLinkedInRequest('POST', '/ugcPosts', this.params, postData);

//       return {
//         status: 'success',
//         data: {
//           id: result?.id,
//           author: input.author,
//           text: input.commentary.substring(0, 100),
//         },
//         summary: `Successfully created LinkedIn post: "${input.commentary.substring(0, 50)}${input.commentary.length > 50 ? '...' : ''}"`,
//       };
//     } catch (error) {
//       return {
//         status: 'error',
//         error: 'Error creating LinkedIn post',
//         summary: error instanceof Error ? error.message : 'Unknown error occurred',
//       };
//     }
//   }
// }

// export class LinkedInDeletePost extends AgentBaseTool<LinkedInParams> {
//   name = 'delete_post';
//   toolsetKey = LinkedInToolsetDefinition.key;

//   schema = z.object({
//     share_id: z.string().describe('Unique identifier of the LinkedIn share (post) to be deleted'),
//   });

//   description = 'Deletes a specific LinkedIn post by its unique share_id.';

//   protected params: LinkedInParams;

//   constructor(params: LinkedInParams) {
//     super(params);
//     this.params = params;
//   }

//   async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
//     try {
//       await makeLinkedInRequest('DELETE', `/ugcPosts/${input.share_id}`, this.params);

//       return {
//         status: 'success',
//         data: { share_id: input.share_id },
//         summary: `Successfully deleted LinkedIn post with ID: ${input.share_id}`,
//       };
//     } catch (error) {
//       return {
//         status: 'error',
//         error: 'Error deleting LinkedIn post',
//         summary: error instanceof Error ? error.message : 'Unknown error occurred',
//       };
//     }
//   }
// }

// export class LinkedInGetMyInfo extends AgentBaseTool<LinkedInParams> {
//   name = 'get_my_info';
//   toolsetKey = LinkedInToolsetDefinition.key;

//   schema = z.object({});

//   description = "Fetches the authenticated LinkedIn user's profile, including author_id.";

//   protected params: LinkedInParams;

//   constructor(params: LinkedInParams) {
//     super(params);
//     this.params = params;
//   }

//   async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
//     try {
//       const result = await makeLinkedInRequest('GET', '/me', this.params);

//       return {
//         status: 'success',
//         data: {
//           id: result?.id,
//           author_id: `urn:li:person:${result?.id}`,
//           firstName: result?.firstName?.localized,
//           lastName: result?.lastName?.localized,
//         },
//         summary: `Successfully retrieved profile information`,
//       };
//     } catch (error) {
//       return {
//         status: 'error',
//         error: 'Error getting user info',
//         summary: error instanceof Error ? error.message : 'Unknown error occurred',
//       };
//     }
//   }
// }

// export class LinkedInGetCompanyInfo extends AgentBaseTool<LinkedInParams> {
//   name = 'get_company_info';
//   toolsetKey = LinkedInToolsetDefinition.key;

//   schema = z.object({
//     role: z
//       .enum(['ADMINISTRATOR', 'DIRECT_SPONSORED_CONTENT_POSTER'])
//       .optional()
//       .describe('The specific role to filter organization ACLs by'),
//     state: z
//       .enum(['APPROVED', 'REQUESTED'])
//       .optional()
//       .describe('The approval state of the role'),
//     count: z.number().optional().describe('Number of organization ACLs to return'),
//     start: z.number().optional().describe('Starting index for pagination'),
//   });

//   description = 'Retrieves organizations where the authenticated user has specific roles.';

//   protected params: LinkedInParams;

//   constructor(params: LinkedInParams) {
//     super(params);
//     this.params = params;
//   }

//   async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
//     try {
//       const params = new URLSearchParams();
//       params.set('q', 'roleAssignee');
//       if (input.role) params.set('role', input.role);
//       if (input.state) params.set('state', input.state);
//       if (input.count) params.set('count', input.count.toString());
//       if (input.start) params.set('start', input.start.toString());

//       const queryString = params.toString();
//       const result = await makeLinkedInRequest(
//         'GET',
//         `/organizationAcls?${queryString}`,
//         this.params,
//       );

//       const organizations = result?.elements ?? [];

//       return {
//         status: 'success',
//         data: {
//           count: organizations.length,
//           organizations: organizations.map((org: any) => ({
//             organization: org.organization,
//             role: org.role,
//             state: org.state,
//           })),
//         },
//         summary: `Found ${organizations.length} organization(s) with specified roles`,
//       };
//     } catch (error) {
//       return {
//         status: 'error',
//         error: 'Error getting company info',
//         summary: error instanceof Error ? error.message : 'Unknown error occurred',
//       };
//     }
//   }
// }

// export class LinkedInToolset extends AgentBaseToolset<LinkedInParams> {
//   toolsetKey = LinkedInToolsetDefinition.key;
//   tools = [
//     LinkedInCreatePost,
//     LinkedInDeletePost,
//     LinkedInGetMyInfo,
//     LinkedInGetCompanyInfo,
//   ] satisfies readonly AgentToolConstructor<LinkedInParams>[];
// }
