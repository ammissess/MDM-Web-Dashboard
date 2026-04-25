import type {
  BaseRecord,
  CreateResponse,
  DataProvider,
  DeleteOneResponse,
  GetListResponse,
  GetManyResponse,
  GetOneResponse,
  UpdateResponse,
} from "@refinedev/core";
import type {
  DeviceDetailResponse,
  DeviceResponse,
  ProfileCreateRequest,
  ProfileResponse,
  ProfileUpdateRequest,
} from "../types/api";
import { http } from "./axios";

type PlainRecord = Record<string, unknown>;

function applyClientPaging<T>(items: T[], page: number, perPage: number) {
  const start = (page - 1) * perPage;
  return items.slice(start, start + perPage);
}

function applyClientSorting(
    items: PlainRecord[],
    sorters?: Array<{ field: string; order: "asc" | "desc" }>,
) {
  if (!sorters?.length) return items;

  const first = sorters[0];
  if (!first?.field) return items;

  const direction = first.order === "asc" ? 1 : -1;

  return [...items].sort((a, b) => {
    const av = a?.[first.field];
    const bv = b?.[first.field];

    if (av == null && bv == null) return 0;
    if (av == null) return -1 * direction;
    if (bv == null) return 1 * direction;

    if (typeof av === "number" && typeof bv === "number") {
      return (av - bv) * direction;
    }

    return String(av).localeCompare(String(bv)) * direction;
  });
}

function applyClientFilters(
    items: PlainRecord[],
    filters?: Array<{
      field?: string;
      operator?: string;
      value?: unknown;
    }>,
) {
  if (!filters?.length) return items;

  let out = [...items];

  for (const filter of filters) {
    const field = filter?.field;
    const operator = filter?.operator;
    const value = filter?.value;

    if (!field) continue;
    if (value == null || value === "") continue;

    if (operator === "eq") {
      out = out.filter((item) => String(item?.[field]) === String(value));
      continue;
    }

    out = out.filter((item) =>
        String(item?.[field] ?? "")
            .toLowerCase()
            .includes(String(value).toLowerCase()),
    );
  }

  return out;
}

export const dataProvider: DataProvider = {
  getApiUrl: () => http.defaults.baseURL ?? "",

  getList: async <TData extends BaseRecord = BaseRecord>({
                                                           resource,
                                                           pagination,
                                                           sorters,
                                                           filters,
                                                         }): Promise<GetListResponse<TData>> => {
    const page = pagination?.current ?? 1;
    const perPage = pagination?.pageSize ?? 20;

    if (resource === "devices") {
      const { data } = await http.get<DeviceResponse[]>("/api/admin/devices");

      const rawItems = (data ?? []) as unknown as TData[];
      const filteredItems = applyClientFilters(
          rawItems as unknown as PlainRecord[],
          (filters as Array<{ field?: string; operator?: string; value?: unknown }>) ?? [],
      ) as unknown as TData[];

      const sortedItems = applyClientSorting(
          filteredItems as unknown as PlainRecord[],
          (sorters as Array<{ field: string; order: "asc" | "desc" }>) ?? [],
      ) as unknown as TData[];

      return {
        data: applyClientPaging(sortedItems, page, perPage),
        total: sortedItems.length,
      };
    }

    if (resource === "profiles") {
      const { data } = await http.get<ProfileResponse[]>("/api/admin/profiles");

      const rawItems = (data ?? []) as unknown as TData[];
      const filteredItems = applyClientFilters(
          rawItems as unknown as PlainRecord[],
          (filters as Array<{ field?: string; operator?: string; value?: unknown }>) ?? [],
      ) as unknown as TData[];

      const sortedItems = applyClientSorting(
          filteredItems as unknown as PlainRecord[],
          (sorters as Array<{ field: string; order: "asc" | "desc" }>) ?? [],
      ) as unknown as TData[];

      return {
        data: applyClientPaging(sortedItems, page, perPage),
        total: sortedItems.length,
      };
    }

    throw new Error(`Unknown resource: ${resource}`);
  },

  getOne: async <TData extends BaseRecord = BaseRecord>({
                                                          resource,
                                                          id,
                                                        }): Promise<GetOneResponse<TData>> => {
    if (resource === "profiles") {
      const { data } = await http.get<ProfileResponse>(`/api/admin/profiles/${id}`);
      return { data: data as unknown as TData };
    }

    if (resource === "devices") {
      const { data } = await http.get<DeviceDetailResponse>(`/api/admin/devices/${id}`);
      return { data: data as unknown as TData };
    }

    throw new Error(`Unknown resource: ${resource}`);
  },

  create: async <TData extends BaseRecord = BaseRecord, TVariables = {}>({
                                                                           resource,
                                                                           variables,
                                                                         }): Promise<CreateResponse<TData>> => {
    if (resource === "profiles") {
      const { data } = await http.post<ProfileResponse>(
          "/api/admin/profiles",
          variables as ProfileCreateRequest,
      );

      return { data: data as unknown as TData };
    }

    throw new Error(`Create not supported for resource: ${resource}`);
  },

  update: async <TData extends BaseRecord = BaseRecord, TVariables = {}>({
                                                                           resource,
                                                                           id,
                                                                           variables,
                                                                         }): Promise<UpdateResponse<TData>> => {
    if (resource === "profiles") {
      const { data } = await http.put<ProfileResponse>(
          `/api/admin/profiles/${id}`,
          variables as ProfileUpdateRequest,
      );

      return { data: data as unknown as TData };
    }

    throw new Error(`Update not supported for resource: ${resource}`);
  },

  deleteOne: async <TData extends BaseRecord = BaseRecord>({
                                                             resource,
                                                             id,
                                                           }): Promise<DeleteOneResponse<TData>> => {
    if (resource === "profiles") {
      await http.delete(`/api/admin/profiles/${id}`);
      return { data: { id } as TData };
    }

    throw new Error(`Delete not supported for resource: ${resource}`);
  },

  getMany: async <TData extends BaseRecord = BaseRecord>({
                                                           resource,
                                                           ids,
                                                         }): Promise<GetManyResponse<TData>> => {
    if (resource === "profiles") {
      const items = await Promise.all(
          ids.map(async (itemId) => {
            const { data } = await http.get<ProfileResponse>(`/api/admin/profiles/${itemId}`);
            return data;
          }),
      );

      return { data: items as unknown as TData[] };
    }

    if (resource === "devices") {
      const items = await Promise.all(
          ids.map(async (itemId) => {
            const { data } = await http.get<DeviceDetailResponse>(`/api/admin/devices/${itemId}`);
            return data;
          }),
      );

      return { data: items as unknown as TData[] };
    }

    throw new Error(`GetMany not supported for resource: ${resource}`);
  },

  createMany: async () => {
    throw new Error("createMany is not supported");
  },

  updateMany: async () => {
    throw new Error("updateMany is not supported");
  },

  deleteMany: async () => {
    throw new Error("deleteMany is not supported");
  },

  custom: async () => {
    throw new Error("custom is not supported");
  },
};