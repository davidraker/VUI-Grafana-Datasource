import {
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  FieldType,
  guessFieldTypeFromValue,
  MutableDataFrame,
} from '@grafana/data';

import { MyDataSourceOptions, MyQuery } from './types';

import { getBackendSrv } from '@grafana/runtime';

export class DataSource extends DataSourceApi<MyQuery, MyDataSourceOptions> {
  url?: string;
  path: string;

  constructor(instanceSettings: DataSourceInstanceSettings<MyDataSourceOptions>) {
    console.log('before super, instanceSettings.url is: ' + instanceSettings.url);
    super(instanceSettings);

    console.log('instanceSettings.url is: ' + instanceSettings.url);
    this.url = instanceSettings.url;
    console.log('In constructor this.url is: ' + this.url);
    this.path = instanceSettings.jsonData.path || '';
  }

  async doRequest(query: MyQuery) {
    console.log('in doRequest, query is: ');
    console.log(query);
    const routePath = '/volttron';
    const url = this.url + routePath + '/vui' + query.route;
    const request: any = {
      method: query.http_method,
      url: url,
      data: query.data,
    };
    console.log('HTTP_METHOD is: ' + query.http_method);
    // if (query.http_method === 'POST' || query.http_method === 'PUT') {
    //   request.data = {};
    // }
    console.log('request is: ');
    console.log(request);
    return await getBackendSrv().fetch(request).toPromise();
  }

  // TODO: This just displays the json response from the API in the panel. This is a (generally not useful) placeholder.
  process_generic(query: MyQuery, response: any): MutableDataFrame {
    const frame = new MutableDataFrame({
      refId: query.refId,
      fields: [{ name: 'Response Value', type: FieldType.string }],
    });
    frame.add({ 'Response Value': JSON.stringify(response.data) });
    return frame;
  }

  // TODO: This only handles the (neither common nor guaranteed) case where the RPC POST returns a list of objects.
  process_platform_agents_rpc_method(query: MyQuery, response: any): MutableDataFrame {
    if (query.http_method === 'POST') {
      let fields = [];
      if (Array.isArray(response.data)) {
        //const keys = Object.keys(response.data[0]);
        //const types = Object.values(response.data[0]).map(x => typeof x);
        for (let k in response.data[0]) {
          fields.push({ name: k, type: guessFieldTypeFromValue(response.data[0][k]) });
        }

        const frame = new MutableDataFrame({
          refId: query.refId,
          fields: fields,
        });
        response.data.forEach((row: any) => {
          frame.add(row);
        });
        return frame;
      } else {
        return this.process_generic(query, response);
      }
    } else {
      return this.process_generic(query, response);
    }
  }

  process_time_series(query: MyQuery, response: any): MutableDataFrame {
    if (query.http_method === 'GET') {
      let fields = [];
      if (Array.isArray(response.data)) {
        //const keys = Object.keys(response.data[0]);
        //const types = Object.values(response.data[0]).map(x => typeof x);
        for (let k in response.data[0]) {
          fields.push({ name: k, type: guessFieldTypeFromValue(3.4) });
        }
        const frame = new MutableDataFrame({
          refId: query.refId,
          fields: fields,
        });
        response.data.forEach((row: any) => {
          frame.add(row['value']);
        });
        return frame;
      } else {
        return this.process_generic(query, response);
      }
    } else {
      return this.process_generic(query, response);
    }
  }

  async query(options: DataQueryRequest<MyQuery>): Promise<DataQueryResponse> {
    console.log('IN DATASOURCE: the DataQueryRequest<MyQuery> called options is: ');
    console.log(options);
    const promises: any = options.targets.map((query) =>
      this.doRequest(query).then((response) => {
        console.log('response is: ');
        console.log(response);
        if (query.route?.match(/^\/platforms\/(?<platform>.+)\/agents\/(?<agent>.+)\/rpc\/(?<method>.+)\/?$/)) {
          return this.process_platform_agents_rpc_method(query, response);
        } else if (
          query.route?.match(/^\/platforms\/(?<platform>.+)\/historians\/(?<agent>.+)\/topics\/(?<topic>.+)\/?$/)
        ) {
          return this.process_time_series(query, response);
        } else {
          return this.process_generic(query, response);
        }
      })
    );
    return Promise.all(promises).then((data) => ({ data }));
  }

  async testDatasource() {
    // Implement a health check for your data source.
    return {
      status: 'success',
      message: 'Success',
    };
  }
}
