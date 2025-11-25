export type DataQueryExecution = {
  dataSourceId: string;
  dataQueryId : string;
  queryText   : string;
  parameters  : Record<string, any>;
  interpolatedQueryText: string;
  queryTime   : string; // formatted duration
  dateTime    : string;
  duration    : string; // formatted duration
  totalRows   : number;
  message     : string;
  results     : any;
};

export type DataQueryExecutionRecord = {
  [dataQueryId: string]: DataQueryExecution[];
};
