export type FieldError = { path: string; message: string };

export type ErrorEntry = {
  id: string;
  actionType: string;
  message: string;
  fields?: FieldError[];
  meta?: unknown;
  createdAt: number;
};

export type ErrorsState = {
  byId: Record<string, ErrorEntry>;
  last: string | null;
};
