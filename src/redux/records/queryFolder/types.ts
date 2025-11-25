export type QueryFolder = {
  queryFolderId : string;
  name          : string;
  description?  : string;
  tags?         : string[];
  color?        : string;
};

export type QueryFolderRecordItem = {
  current   : QueryFolder;
  persisted : QueryFolder | {};
  unsaved   : Partial<SaveQueryFolder>;
  isUnsaved : boolean;
  isInvalid : boolean;
};

export type QueryFolderRecord = {
  [queryFolderId: string]: QueryFolderRecordItem;
} & {
  // Minimal changes captured at write-time per queryFolderId
  changesById?: QueryFolderChanges;
}

// Write-time change tracking model (see diffplan.md)
export type QueryFolderChanges = {
  [queryFolderId: string]: Partial<{
    name        : string;
    description : string;
    tags        : string[];
    color       : string;
  }>;
};

export type SaveQueryFolder = {
  create? : {
    queryFolderId : string;
    name          : string;
    description?  : string;
    tags?         : string[];
    color?        : string;
  },
  update? : {
    queryFolderId : string;
    name?         : string;
    description?  : string;
    tags?         : string[];
    color?        : string;
  },
  delete?       : string[];
};
