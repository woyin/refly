// This file is auto-generated by @hey-api/openapi-ts

import { client, type Options, formDataBodySerializer } from '@hey-api/client-fetch';
import type {
  ListResourcesData,
  ListResourcesError,
  ListResourcesResponse,
  GetResourceDetailData,
  GetResourceDetailError,
  GetResourceDetailResponse2,
  UpdateResourceData,
  UpdateResourceError,
  UpdateResourceResponse,
  CreateResourceData,
  CreateResourceError,
  CreateResourceResponse,
  BatchCreateResourceData,
  BatchCreateResourceError,
  BatchCreateResourceResponse2,
  ReindexResourceData,
  ReindexResourceError,
  ReindexResourceResponse2,
  DeleteResourceData,
  DeleteResourceError,
  DeleteResourceResponse,
  ListCanvasData,
  ListCanvasError,
  ListCanvasResponse2,
  GetCanvasDetailData,
  GetCanvasDetailError,
  GetCanvasDetailResponse2,
  UpdateCanvasData,
  UpdateCanvasError,
  UpdateCanvasResponse,
  CreateCanvasData,
  CreateCanvasError,
  CreateCanvasResponse,
  DeleteCanvasData,
  DeleteCanvasError,
  DeleteCanvasResponse,
  BatchUpdateCanvasData,
  BatchUpdateCanvasError,
  BatchUpdateCanvasResponse,
  QueryReferencesData,
  QueryReferencesError,
  QueryReferencesResponse2,
  OperateReferencesData,
  OperateReferencesError,
  OperateReferencesResponse,
  DeleteReferencesData,
  DeleteReferencesError,
  DeleteReferencesResponse,
  ListProjectsData,
  ListProjectsError,
  ListProjectsResponse,
  GetProjectDetailData,
  GetProjectDetailError,
  GetProjectDetailResponse2,
  UpdateProjectData,
  UpdateProjectError,
  UpdateProjectResponse,
  CreateProjectData,
  CreateProjectError,
  CreateProjectResponse,
  BindProjectResourcesData,
  BindProjectResourcesError,
  BindProjectResourcesResponse,
  DeleteProjectData,
  DeleteProjectError,
  DeleteProjectResponse,
  CreateShareData,
  CreateShareError,
  CreateShareResponse2,
  DeleteShareData,
  DeleteShareError,
  DeleteShareResponse,
  GetShareContentData,
  GetShareContentError,
  GetShareContentResponse2,
  ListLabelClassesData,
  ListLabelClassesError,
  ListLabelClassesResponse2,
  CreateLabelClassData,
  CreateLabelClassError,
  CreateLabelClassResponse,
  UpdateLabelClassData,
  UpdateLabelClassError,
  UpdateLabelClassResponse,
  DeleteLabelClassData,
  DeleteLabelClassError,
  DeleteLabelClassResponse,
  ListLabelInstancesData,
  ListLabelInstancesError,
  ListLabelInstancesResponse2,
  CreateLabelInstanceData,
  CreateLabelInstanceError,
  CreateLabelInstanceResponse,
  UpdateLabelInstanceData,
  UpdateLabelInstanceError,
  UpdateLabelInstanceResponse,
  DeleteLabelInstanceData,
  DeleteLabelInstanceError,
  DeleteLabelInstanceResponse,
  ListSkillTemplatesData,
  ListSkillTemplatesError,
  ListSkillTemplatesResponse,
  ListSkillInstancesData,
  ListSkillInstancesError,
  ListSkillInstancesResponse,
  CreateSkillInstanceData,
  CreateSkillInstanceError,
  CreateSkillInstanceResponse2,
  UpdateSkillInstanceData,
  UpdateSkillInstanceError,
  UpdateSkillInstanceResponse2,
  PinSkillInstanceData,
  PinSkillInstanceError,
  PinSkillInstanceResponse,
  UnpinSkillInstanceData,
  UnpinSkillInstanceError,
  UnpinSkillInstanceResponse,
  DeleteSkillInstanceData,
  DeleteSkillInstanceError,
  DeleteSkillInstanceResponse,
  InvokeSkillData,
  InvokeSkillError,
  InvokeSkillResponse2,
  StreamInvokeSkillData,
  StreamInvokeSkillError,
  StreamInvokeSkillResponse,
  ListSkillTriggersData,
  ListSkillTriggersError,
  ListSkillTriggersResponse,
  CreateSkillTriggerData,
  CreateSkillTriggerError,
  CreateSkillTriggerResponse2,
  UpdateSkillTriggerData,
  UpdateSkillTriggerError,
  UpdateSkillTriggerResponse2,
  DeleteSkillTriggerData,
  DeleteSkillTriggerError,
  DeleteSkillTriggerResponse,
  ListSkillJobsData,
  ListSkillJobsError,
  ListSkillJobsResponse2,
  GetSkillJobDetailData,
  GetSkillJobDetailError,
  GetSkillJobDetailResponse2,
  ListConversationsData,
  ListConversationsError,
  ListConversationsResponse,
  GetConversationDetailData,
  GetConversationDetailError,
  GetConversationDetailResponse2,
  GetSettingsError,
  GetSettingsResponse,
  UpdateSettingsData,
  UpdateSettingsError,
  UpdateSettingsResponse,
  CheckSettingsFieldData,
  CheckSettingsFieldError,
  CheckSettingsFieldResponse2,
  GetSubscriptionPlanError,
  GetSubscriptionPlanResponse,
  GetSubscriptionUsageError,
  GetSubscriptionUsageResponse2,
  ListModelsError,
  ListModelsResponse2,
  CreateCheckoutSessionData,
  CreateCheckoutSessionError,
  CreateCheckoutSessionResponse2,
  CreatePortalSessionError,
  CreatePortalSessionResponse2,
  SearchData,
  SearchError,
  SearchResponse2,
  ScrapeData,
  ScrapeError,
  ScrapeResponse,
  UploadData,
  UploadError,
  UploadResponse2,
  ServeStaticError,
  ServeStaticResponse,
} from './types.gen';

/**
 * List resources
 * List all resources
 */
export const listResources = (options?: Options<ListResourcesData>) => {
  return (options?.client ?? client).get<ListResourcesResponse, ListResourcesError>({
    ...options,
    url: '/knowledge/resource/list',
  });
};

/**
 * Get resource detail
 * Return resource detail along with its document content
 */
export const getResourceDetail = (options: Options<GetResourceDetailData>) => {
  return (options?.client ?? client).get<GetResourceDetailResponse2, GetResourceDetailError>({
    ...options,
    url: '/knowledge/resource/detail',
  });
};

/**
 * Update resource
 * Update an existing resource
 */
export const updateResource = (options: Options<UpdateResourceData>) => {
  return (options?.client ?? client).post<UpdateResourceResponse, UpdateResourceError>({
    ...options,
    url: '/knowledge/resource/update',
  });
};

/**
 * Create new resource
 * Create a new resource
 */
export const createResource = (options: Options<CreateResourceData>) => {
  return (options?.client ?? client).post<CreateResourceResponse, CreateResourceError>({
    ...options,
    url: '/knowledge/resource/new',
  });
};

/**
 * Batch create new resources
 * Batch create a new resource
 */
export const batchCreateResource = (options: Options<BatchCreateResourceData>) => {
  return (options?.client ?? client).post<BatchCreateResourceResponse2, BatchCreateResourceError>({
    ...options,
    url: '/knowledge/resource/batch',
  });
};

/**
 * Reindex resource
 * Reindex an existing resource
 */
export const reindexResource = (options: Options<ReindexResourceData>) => {
  return (options?.client ?? client).post<ReindexResourceResponse2, ReindexResourceError>({
    ...options,
    url: '/knowledge/resource/reindex',
  });
};

/**
 * Delete resource
 * Delete an existing resource
 */
export const deleteResource = (options: Options<DeleteResourceData>) => {
  return (options?.client ?? client).post<DeleteResourceResponse, DeleteResourceError>({
    ...options,
    url: '/knowledge/resource/delete',
  });
};

/**
 * List user canvases
 * List all canvases for a user
 */
export const listCanvas = (options?: Options<ListCanvasData>) => {
  return (options?.client ?? client).get<ListCanvasResponse2, ListCanvasError>({
    ...options,
    url: '/knowledge/canvas/list',
  });
};

/**
 * Get canvas detail
 * Return canvas detail
 */
export const getCanvasDetail = (options: Options<GetCanvasDetailData>) => {
  return (options?.client ?? client).get<GetCanvasDetailResponse2, GetCanvasDetailError>({
    ...options,
    url: '/knowledge/canvas/detail',
  });
};

/**
 * Update canvas
 * Update an existing canvas
 */
export const updateCanvas = (options: Options<UpdateCanvasData>) => {
  return (options?.client ?? client).post<UpdateCanvasResponse, UpdateCanvasError>({
    ...options,
    url: '/knowledge/canvas/update',
  });
};

/**
 * Create new canvas
 * Create a new canvas
 */
export const createCanvas = (options: Options<CreateCanvasData>) => {
  return (options?.client ?? client).post<CreateCanvasResponse, CreateCanvasError>({
    ...options,
    url: '/knowledge/canvas/new',
  });
};

/**
 * Delete canvas
 * Delete an existing canvas
 */
export const deleteCanvas = (options: Options<DeleteCanvasData>) => {
  return (options?.client ?? client).post<DeleteCanvasResponse, DeleteCanvasError>({
    ...options,
    url: '/knowledge/canvas/delete',
  });
};

/**
 * Batch update canvases
 * Batch update existing canvases
 */
export const batchUpdateCanvas = (options: Options<BatchUpdateCanvasData>) => {
  return (options?.client ?? client).post<BatchUpdateCanvasResponse, BatchUpdateCanvasError>({
    ...options,
    url: '/knowledge/canvas/batchUpdate',
  });
};

/**
 * Query references
 * Query references by source or target entity
 */
export const queryReferences = (options: Options<QueryReferencesData>) => {
  return (options?.client ?? client).post<QueryReferencesResponse2, QueryReferencesError>({
    ...options,
    url: '/knowledge/reference/query',
  });
};

/**
 * Operate references
 * Operate references between source and target entities
 */
export const operateReferences = (options: Options<OperateReferencesData>) => {
  return (options?.client ?? client).post<OperateReferencesResponse, OperateReferencesError>({
    ...options,
    url: '/knowledge/reference/add',
  });
};

/**
 * Delete references
 * Delete references between source and target entities
 */
export const deleteReferences = (options: Options<DeleteReferencesData>) => {
  return (options?.client ?? client).post<DeleteReferencesResponse, DeleteReferencesError>({
    ...options,
    url: '/knowledge/reference/delete',
  });
};

/**
 * List user projects
 * List all projects for a user
 */
export const listProjects = (options?: Options<ListProjectsData>) => {
  return (options?.client ?? client).get<ListProjectsResponse, ListProjectsError>({
    ...options,
    url: '/knowledge/project/list',
  });
};

/**
 * Get project detail
 * Return project details along with its canvases
 */
export const getProjectDetail = (options: Options<GetProjectDetailData>) => {
  return (options?.client ?? client).get<GetProjectDetailResponse2, GetProjectDetailError>({
    ...options,
    url: '/knowledge/project/detail',
  });
};

/**
 * Update project
 * Update an existing project
 */
export const updateProject = (options: Options<UpdateProjectData>) => {
  return (options?.client ?? client).post<UpdateProjectResponse, UpdateProjectError>({
    ...options,
    url: '/knowledge/project/update',
  });
};

/**
 * Create new project
 * Create a new project
 */
export const createProject = (options: Options<CreateProjectData>) => {
  return (options?.client ?? client).post<CreateProjectResponse, CreateProjectError>({
    ...options,
    url: '/knowledge/project/new',
  });
};

/**
 * Bind resources to project
 * Bind existing resources to a project
 */
export const bindProjectResources = (options: Options<BindProjectResourcesData>) => {
  return (options?.client ?? client).post<BindProjectResourcesResponse, BindProjectResourcesError>({
    ...options,
    url: '/knowledge/project/bindRes',
  });
};

/**
 * Delete project
 * Delete an existing project
 */
export const deleteProject = (options: Options<DeleteProjectData>) => {
  return (options?.client ?? client).post<DeleteProjectResponse, DeleteProjectError>({
    ...options,
    url: '/knowledge/project/delete',
  });
};

/**
 * Create share
 * Create new share for project or canvas
 */
export const createShare = (options: Options<CreateShareData>) => {
  return (options?.client ?? client).post<CreateShareResponse2, CreateShareError>({
    ...options,
    url: '/share/new',
  });
};

/**
 * Delete share
 * Delete an existing share
 */
export const deleteShare = (options: Options<DeleteShareData>) => {
  return (options?.client ?? client).post<DeleteShareResponse, DeleteShareError>({
    ...options,
    url: '/share/delete',
  });
};

/**
 * Get share content
 * Get share content by share code
 */
export const getShareContent = (options: Options<GetShareContentData>) => {
  return (options?.client ?? client).get<GetShareContentResponse2, GetShareContentError>({
    ...options,
    url: '/share/content',
  });
};

/**
 * List label classes
 * List all label classes
 */
export const listLabelClasses = (options?: Options<ListLabelClassesData>) => {
  return (options?.client ?? client).get<ListLabelClassesResponse2, ListLabelClassesError>({
    ...options,
    url: '/label/class/list',
  });
};

/**
 * Create new label class
 * Create a new label class
 */
export const createLabelClass = (options: Options<CreateLabelClassData>) => {
  return (options?.client ?? client).post<CreateLabelClassResponse, CreateLabelClassError>({
    ...options,
    url: '/label/class/new',
  });
};

/**
 * Update label class
 * Update an existing label class
 */
export const updateLabelClass = (options: Options<UpdateLabelClassData>) => {
  return (options?.client ?? client).post<UpdateLabelClassResponse, UpdateLabelClassError>({
    ...options,
    url: '/label/class/update',
  });
};

/**
 * Delete label class
 * Delete an existing label class
 */
export const deleteLabelClass = (options: Options<DeleteLabelClassData>) => {
  return (options?.client ?? client).post<DeleteLabelClassResponse, DeleteLabelClassError>({
    ...options,
    url: '/label/class/delete',
  });
};

/**
 * List labels
 * List all label instances
 */
export const listLabelInstances = (options?: Options<ListLabelInstancesData>) => {
  return (options?.client ?? client).get<ListLabelInstancesResponse2, ListLabelInstancesError>({
    ...options,
    url: '/label/instance/list',
  });
};

/**
 * Create new label instance
 * Create new label instance
 */
export const createLabelInstance = (options: Options<CreateLabelInstanceData>) => {
  return (options?.client ?? client).post<CreateLabelInstanceResponse, CreateLabelInstanceError>({
    ...options,
    url: '/label/instance/new',
  });
};

/**
 * Update label
 * Update an existing label instance
 */
export const updateLabelInstance = (options: Options<UpdateLabelInstanceData>) => {
  return (options?.client ?? client).post<UpdateLabelInstanceResponse, UpdateLabelInstanceError>({
    ...options,
    url: '/label/instance/update',
  });
};

/**
 * Delete label
 * Delete an existing label
 */
export const deleteLabelInstance = (options: Options<DeleteLabelInstanceData>) => {
  return (options?.client ?? client).post<DeleteLabelInstanceResponse, DeleteLabelInstanceError>({
    ...options,
    url: '/label/instance/delete',
  });
};

/**
 * List skill templates
 * List all skill templates
 */
export const listSkillTemplates = (options?: Options<ListSkillTemplatesData>) => {
  return (options?.client ?? client).get<ListSkillTemplatesResponse, ListSkillTemplatesError>({
    ...options,
    url: '/skill/template/list',
  });
};

/**
 * List skill instances
 * List skill instances for a user
 */
export const listSkillInstances = (options?: Options<ListSkillInstancesData>) => {
  return (options?.client ?? client).get<ListSkillInstancesResponse, ListSkillInstancesError>({
    ...options,
    url: '/skill/instance/list',
  });
};

/**
 * Create new skill instance
 * Create a new skill instance for user
 */
export const createSkillInstance = (options: Options<CreateSkillInstanceData>) => {
  return (options?.client ?? client).post<CreateSkillInstanceResponse2, CreateSkillInstanceError>({
    ...options,
    url: '/skill/instance/new',
  });
};

/**
 * Update skill instance
 * Update an existing skill instance
 */
export const updateSkillInstance = (options: Options<UpdateSkillInstanceData>) => {
  return (options?.client ?? client).post<UpdateSkillInstanceResponse2, UpdateSkillInstanceError>({
    ...options,
    url: '/skill/instance/update',
  });
};

/**
 * Pin skill instance
 * Pin an existing skill instance
 */
export const pinSkillInstance = (options: Options<PinSkillInstanceData>) => {
  return (options?.client ?? client).post<PinSkillInstanceResponse, PinSkillInstanceError>({
    ...options,
    url: '/skill/instance/pin',
  });
};

/**
 * Unpin skill instance
 * Unpin an existing skill instance
 */
export const unpinSkillInstance = (options: Options<UnpinSkillInstanceData>) => {
  return (options?.client ?? client).post<UnpinSkillInstanceResponse, UnpinSkillInstanceError>({
    ...options,
    url: '/skill/instance/unpin',
  });
};

/**
 * Delete skill instance
 * Delete an existing skill instance
 */
export const deleteSkillInstance = (options: Options<DeleteSkillInstanceData>) => {
  return (options?.client ?? client).post<DeleteSkillInstanceResponse, DeleteSkillInstanceError>({
    ...options,
    url: '/skill/instance/delete',
  });
};

/**
 * Invoke skill
 * Invoke a skill
 */
export const invokeSkill = (options: Options<InvokeSkillData>) => {
  return (options?.client ?? client).post<InvokeSkillResponse2, InvokeSkillError>({
    ...options,
    url: '/skill/invoke',
  });
};

/**
 * Stream invoke skill
 * Invoke a skill and return SSE stream
 */
export const streamInvokeSkill = (options: Options<StreamInvokeSkillData>) => {
  return (options?.client ?? client).post<StreamInvokeSkillResponse, StreamInvokeSkillError>({
    ...options,
    url: '/skill/streamInvoke',
  });
};

/**
 * List skill triggers
 * List all skill triggers
 */
export const listSkillTriggers = (options?: Options<ListSkillTriggersData>) => {
  return (options?.client ?? client).get<ListSkillTriggersResponse, ListSkillTriggersError>({
    ...options,
    url: '/skill/trigger/list',
  });
};

/**
 * Create new trigger
 * Create a new trigger
 */
export const createSkillTrigger = (options: Options<CreateSkillTriggerData>) => {
  return (options?.client ?? client).post<CreateSkillTriggerResponse2, CreateSkillTriggerError>({
    ...options,
    url: '/skill/trigger/new',
  });
};

/**
 * Update trigger
 * Update an existing trigger
 */
export const updateSkillTrigger = (options: Options<UpdateSkillTriggerData>) => {
  return (options?.client ?? client).post<UpdateSkillTriggerResponse2, UpdateSkillTriggerError>({
    ...options,
    url: '/skill/trigger/update',
  });
};

/**
 * Delete trigger
 * Delete an existing trigger
 */
export const deleteSkillTrigger = (options: Options<DeleteSkillTriggerData>) => {
  return (options?.client ?? client).post<DeleteSkillTriggerResponse, DeleteSkillTriggerError>({
    ...options,
    url: '/skill/trigger/delete',
  });
};

/**
 * Get skill jobs
 * Get skill jobs
 */
export const listSkillJobs = (options?: Options<ListSkillJobsData>) => {
  return (options?.client ?? client).get<ListSkillJobsResponse2, ListSkillJobsError>({
    ...options,
    url: '/skill/job/list',
  });
};

/**
 * Get skill job detail
 * Get skill job detail
 */
export const getSkillJobDetail = (options?: Options<GetSkillJobDetailData>) => {
  return (options?.client ?? client).get<GetSkillJobDetailResponse2, GetSkillJobDetailError>({
    ...options,
    url: '/skill/job/detail',
  });
};

/**
 * List conversations
 * List all conversations
 */
export const listConversations = (options?: Options<ListConversationsData>) => {
  return (options?.client ?? client).get<ListConversationsResponse, ListConversationsError>({
    ...options,
    url: '/conversation/list',
  });
};

/**
 * Get conversation detail
 * Get conversation detail
 */
export const getConversationDetail = (options: Options<GetConversationDetailData>) => {
  return (options?.client ?? client).get<GetConversationDetailResponse2, GetConversationDetailError>({
    ...options,
    url: '/conversation/{convId}',
  });
};

/**
 * Get user settings
 * Return settings for current user
 */
export const getSettings = (options?: Options) => {
  return (options?.client ?? client).get<GetSettingsResponse, GetSettingsError>({
    ...options,
    url: '/user/settings',
  });
};

/**
 * Update user settings
 * Update settings for current user
 */
export const updateSettings = (options: Options<UpdateSettingsData>) => {
  return (options?.client ?? client).put<UpdateSettingsResponse, UpdateSettingsError>({
    ...options,
    url: '/user/settings',
  });
};

/**
 * Check settings field
 * Given a settings field, check if the given value is valid
 */
export const checkSettingsField = (options: Options<CheckSettingsFieldData>) => {
  return (options?.client ?? client).get<CheckSettingsFieldResponse2, CheckSettingsFieldError>({
    ...options,
    url: '/user/checkSettingsField',
  });
};

/**
 * Get subscription plan
 * Get subscription plan
 */
export const getSubscriptionPlan = (options?: Options) => {
  return (options?.client ?? client).get<GetSubscriptionPlanResponse, GetSubscriptionPlanError>({
    ...options,
    url: '/subscription/plan',
  });
};

/**
 * Get subscription usage
 * Get subscription usage
 */
export const getSubscriptionUsage = (options?: Options) => {
  return (options?.client ?? client).get<GetSubscriptionUsageResponse2, GetSubscriptionUsageError>({
    ...options,
    url: '/subscription/usage',
  });
};

/**
 * List models
 * List all available models
 */
export const listModels = (options?: Options) => {
  return (options?.client ?? client).get<ListModelsResponse2, ListModelsError>({
    ...options,
    url: '/subscription/modelList',
  });
};

/**
 * Create checkout session
 * Create a checkout session
 */
export const createCheckoutSession = (options: Options<CreateCheckoutSessionData>) => {
  return (options?.client ?? client).post<CreateCheckoutSessionResponse2, CreateCheckoutSessionError>({
    ...options,
    url: '/subscription/createCheckoutSession',
  });
};

/**
 * Create portal session
 * Create a portal session
 */
export const createPortalSession = (options?: Options) => {
  return (options?.client ?? client).post<CreatePortalSessionResponse2, CreatePortalSessionError>({
    ...options,
    url: '/subscription/createPortalSession',
  });
};

/**
 * Search
 * Search for canvases, resources, projects, etc.
 */
export const search = (options: Options<SearchData>) => {
  return (options?.client ?? client).post<SearchResponse2, SearchError>({
    ...options,
    url: '/search',
  });
};

/**
 * Scrape
 * Scrape a weblink
 */
export const scrape = (options: Options<ScrapeData>) => {
  return (options?.client ?? client).post<ScrapeResponse, ScrapeError>({
    ...options,
    url: '/misc/scrape',
  });
};

/**
 * Upload
 * Upload a file
 */
export const upload = (options: Options<UploadData>) => {
  return (options?.client ?? client).post<UploadResponse2, UploadError>({
    ...options,
    ...formDataBodySerializer,
    url: '/misc/upload',
  });
};

/**
 * Serve static
 * Serve static files (only for local testing)
 */
export const serveStatic = (options?: Options) => {
  return (options?.client ?? client).get<ServeStaticResponse, ServeStaticError>({
    ...options,
    url: '/misc/static/{fileName}',
  });
};
