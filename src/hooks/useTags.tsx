import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import * as api from "../lib/api";
import type { Tag } from "../types";

interface TagsContextValue {
  tags: Tag[];
  isLoading: boolean;
  createTag: (name: string, color: string, icon?: string) => Promise<Tag>;
  updateTag: (
    id: string,
    name: string,
    color: string,
    icon?: string,
  ) => Promise<Tag>;
  deleteTag: (id: string) => Promise<void>;
  reorderTags: (ids: string[]) => Promise<void>;
  getTagById: (id: string | null | undefined) => Tag | null;
}

const TagsContext = createContext<TagsContextValue | null>(null);

interface TagsProviderProps {
  children: ReactNode;
}

export function TagsProvider({ children }: TagsProviderProps) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    api
      .getTags()
      .then((loadedTags) => {
        if (!cancelled) {
          setTags(loadedTags);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const createTag = useCallback(
    async (name: string, color: string, icon?: string) => {
      const tag = await api.createTag(name, color, icon);
      setTags((current) => [...current, tag].sort(compareTags));
      return tag;
    },
    [],
  );

  const updateTag = useCallback(
    async (id: string, name: string, color: string, icon?: string) => {
      const tag = await api.updateTag(id, name, color, icon);
      setTags((current) =>
        current.map((currentTag) => (currentTag.id === id ? tag : currentTag)),
      );
      return tag;
    },
    [],
  );

  const deleteTag = useCallback(async (id: string) => {
    await api.deleteTag(id);
    setTags((current) => current.filter((tag) => tag.id !== id));
  }, []);

  const reorderTags = useCallback(async (ids: string[]) => {
    await api.reorderTags(ids);
    setTags((current) => {
      const byId = new Map(current.map((tag) => [tag.id, tag]));
      return ids
        .map((id, index) => {
          const tag = byId.get(id);
          return tag ? { ...tag, sortOrder: index } : null;
        })
        .filter((tag): tag is Tag => tag !== null);
    });
  }, []);

  const getTagById = useCallback(
    (id: string | null | undefined) =>
      id ? tags.find((tag) => tag.id === id) ?? null : null,
    [tags],
  );

  const value = useMemo<TagsContextValue>(
    () => ({
      tags,
      isLoading,
      createTag,
      updateTag,
      deleteTag,
      reorderTags,
      getTagById,
    }),
    [createTag, deleteTag, getTagById, isLoading, reorderTags, tags, updateTag],
  );

  return <TagsContext.Provider value={value}>{children}</TagsContext.Provider>;
}

export function useTags() {
  const context = useContext(TagsContext);

  if (!context) {
    throw new Error("useTags must be used inside TagsProvider");
  }

  return context;
}

function compareTags(left: Tag, right: Tag): number {
  return left.sortOrder - right.sortOrder || left.createdAt.localeCompare(right.createdAt);
}
