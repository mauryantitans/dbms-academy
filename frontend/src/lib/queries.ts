import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import type { Course, Dataset, LessonDetail, LessonStatus, LessonSummary, Progress } from "./types";

/** The full curriculum tree (modules → chapters → lesson summaries, projects, exams). Static per deployment. */
export function useCourse() {
  return useQuery({ queryKey: ["course"], queryFn: () => api<Course>("/course"), staleTime: Infinity });
}

/** The learner's progress summary. Invalidate ["progress"] after anything that changes it. */
export function useProgress() {
  return useQuery({ queryKey: ["progress"], queryFn: () => api<Progress>("/progress") });
}

export function useLesson(id: string) {
  return useQuery({
    queryKey: ["lesson", id],
    queryFn: () => api<LessonDetail>(`/lessons/${encodeURIComponent(id)}`),
    enabled: !!id,
    staleTime: Infinity,
  });
}

/** Sandbox datasets, keyed by dataset id. */
export function useDatasets() {
  return useQuery({ queryKey: ["datasets"], queryFn: () => api<Record<string, Dataset>>("/datasets"), staleTime: Infinity });
}

// Identical status updates already in flight are shared, so a double-fired effect sends one request.
const pendingStatus = new Map<string, Promise<{ status: LessonStatus | null }>>();

function putLessonStatus(id: string, status: LessonStatus) {
  const key = `${id}\u0000${status}`;
  let p = pendingStatus.get(key);
  if (!p) {
    p = api<{ status: LessonStatus | null }>(`/progress/lessons/${encodeURIComponent(id)}`, { method: "PUT", json: { status } })
      .finally(() => pendingStatus.delete(key));
    pendingStatus.set(key, p);
  }
  return p;
}

export function useSetLessonStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: LessonStatus }) => putLessonStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["progress"] }),
  });
}

/** Every lesson of the course in curriculum order. */
export function flatLessons(course: Course | null | undefined): LessonSummary[] {
  return course ? course.modules.flatMap((m) => m.chapters.flatMap((c) => c.lessons)) : [];
}
