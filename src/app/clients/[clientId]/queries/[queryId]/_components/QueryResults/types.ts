export type DataQueryExecutionRecord = {
  [dataQueryId: string]: Execution[];
};

export type Execution = {
  dataSourceId: string;
  dataQueryId: string;
  queryText: string;
  parameters: Record<string, any>;
  interpolatedQueryText: string;
  queryTime: string; // formatted duration
  dateTime: string;
  duration: string; // formatted duration
  totalRows: number;
  message: string;
  results: any;
};
