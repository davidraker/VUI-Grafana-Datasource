import { DataQuery, DataSourceJsonData } from '@grafana/data';

export interface MyQuery extends DataQuery {
  route?: string;
  http_method?: string;
  data?: object;
}

export const defaultQuery: Partial<MyQuery> = {
  http_method: 'GET',
  route: '/vui'
};

/**
 * These are options configured for each DataSource instance
 */
export interface MyDataSourceOptions extends DataSourceJsonData {
  path?: string;
  username?: string;
}

/**
 * Value that is used in the backend, but never sent over HTTP to the frontend
 */
export interface MySecureJsonData {
  password?: string;
}
