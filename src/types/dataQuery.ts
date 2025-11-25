import { UUIDv7 } from './primitives';


type DataQueryEditField = 'name' | 'queryText' | 'ext' | 'description' | 'tags' | 'color' | 'parameters';
type Color = 'blue' | 'green' | 'purple' | 'red' | 'yellow' | 'orange' | 'pink' | 'brown' | 'gray' | 'black' | 'white';

type DataQuery = {
  dataQueryId   : UUIDv7;
  name          : string;
  ext           : string;
  queryText     : string | '';
  description   : string | '';
  tags          : string[] | [];
  color         : Color | null;
  parameters?   : Record<string, any>;
};


export type {
  DataQuery,
  DataQueryEditField
}
