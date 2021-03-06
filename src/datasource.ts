import {
  CircularDataFrame,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  FieldType,
  guessFieldTypeFromValue,
  MutableDataFrame,
} from '@grafana/data';

import { defaultQuery, MyDataSourceOptions, MyQuery } from './types';

import { FetchResponse, getBackendSrv } from '@grafana/runtime';
import { Observable } from 'rxjs';
import { filter, merge } from 'rxjs/operators';
import { defaults, isEmpty } from 'lodash';

function first_unique_segment(entries: any[][]) {
  const e_list = entries.map((x, i) => x[0].split('/'));
  const zipped = Array(
    Math.min.apply(
      Math,
      e_list.map((x) => x.length)
    )
  )
    .fill([])
    .map((x, i) => e_list.map((s) => s[i]));
  return zipped.map((x) => x.every((y, i, arr) => y === arr[0])).indexOf(false);
}

export class DataSource extends DataSourceApi<MyQuery, MyDataSourceOptions> {
  url?: string;
  path: string;

  constructor(instanceSettings: DataSourceInstanceSettings<MyDataSourceOptions>) {
    super(instanceSettings);
    this.url = instanceSettings.url;
    this.path = instanceSettings.jsonData.path || '';
  }

  route_update_callback(path?: string): (options_response: any) => void {
    console.log('Datasource route_update_callback received something but callback has not been set! ');
    return () => {};
  }

  log_and_return(x: string, return_empty: boolean): string {
    console.log(x);
    return return_empty ? '' : x;
  }

  doRequest(query: MyQuery, request_type: string) {
    console.log('IN DO_REQUEST');
    const routePath = request_type === 'websocket' ? '/vuiwebsock' : '/volttron';
    let url = this.url + routePath + '/vui' + query.route;
    // if (routePath === '/vuiwebsock') {
    //   url = 'ws:/' + url
    // }
    const request: any = {
      method: query.http_method,
      url: url,
      data: query.data,
    };
    console.log('request is: ');
    console.log(request);
    return getBackendSrv().fetch(request);
  }

  alert_on_error(response: Observable<FetchResponse>) {
    response.pipe(filter((x) => !isEmpty(x.data.error))).subscribe({
      next(x: any) {
        console.log('VUI ERROR: ', x.data.error);
        alert(x.data.error);
      },
      error(x) {
        console.log('VUI ERROR: ', x.data.error);
        alert(x.data.error);
      },
      complete() {},
    });
  }

  process_route_options(
    query: MyQuery,
    options: DataQueryRequest,
    response: Observable<FetchResponse>
  ): Observable<DataQueryResponse> {
    response.pipe(filter((x) => !isEmpty(x.data.route_options))).subscribe(this.route_update_callback(query.route));
    return this._empty_data_frame_observable(query);
  }

  process_generic(
    query: MyQuery,
    options: DataQueryRequest,
    response: Observable<FetchResponse>
  ): Observable<DataQueryResponse> {
    console.log('IN PROCESS_GENERIC');
    return new Observable<DataQueryResponse>((subscriber) => {
      const frame = new MutableDataFrame({
        refId: query.refId,
        fields: [{ name: 'Response Value', type: FieldType.string }],
      });
      response.pipe(filter((x) => isEmpty(x.data.route_options))).subscribe({
        next(x) {
          frame.add({ 'Response Value': JSON.stringify(x.data) });
          subscriber.next({
            data: [frame],
            key: query.refId,
          });
        },
      });
    });
  }

  // TODO: This only handles the (neither common nor guaranteed) case where the RPC POST returns a list of objects.
  process_platform_agents_rpc_method(
    query: MyQuery,
    options: DataQueryRequest,
    response: Observable<FetchResponse>
  ): Observable<DataQueryResponse> {
    // if (query.http_method === 'POST') {
    //   let fields = [];
    //   if (Array.isArray(response.data)) {
    //     //const keys = Object.keys(response.data[0]);
    //     //const types = Object.values(response.data[0]).map(x => typeof x);
    //     for (let k in response.data[0]) {
    //       fields.push({ name: k, type: guessFieldTypeFromValue(response.data[0][k]) });
    //     }
    //
    //     const frame = new MutableDataFrame({
    //       refId: query.refId,
    //       fields: fields,
    //     });
    //     response.data.forEach((row: any) => {
    //       frame.add(row);
    //     });
    //     return frame;
    //   } else {
    return this.process_generic(query, options, response);
    //   }
    // } else {
    //   return this.process_generic(query, options, response);
    // }
  }

  log_all_nexts(response: Observable<FetchResponse>) {
    response.subscribe({
      next(x: any) {
        console.log('LOG_ALL_NEXTS NEXT:');
        console.log(x);
      },
      error(err: any) {
        console.log('LOG_ALL_NEXTS ERROR: ');
        console.log(err.data.error);
      },
      complete() {
        console.log('LOG_ALL_NEXTS COMPLETE');
      },
    });
  }

  process_historian_ts(
    query: MyQuery,
    options: DataQueryRequest,
    response: Observable<FetchResponse>
  ): Observable<DataQueryResponse> {
    console.log('IN PROCESS_HISTORIAN_TS');
    return new Observable<DataQueryResponse>((subscriber) => {
      const frame = new CircularDataFrame({
        append: 'tail',
        capacity: options.maxDataPoints,
      });
      response.pipe(filter((x) => isEmpty(x.data.route_options))).subscribe({
        next(x) {
          const entries: any = Object.entries(x.data);
          //TODO: Adjust topic names once in first_unique_segment, instead of in many places here and in devices.
          const unique_seg = first_unique_segment(entries);
          if (frame.fields.length === 0) {
            frame.refId = query.refId;
            frame.addField({ name: 'Time', type: FieldType.time });
            for (let [topic, data] of entries) {
              const field_name = topic.split('/').slice(unique_seg).join('/') || '';
              const first_value = data.value[0][1];
              frame.addField({
                name: field_name,
                type: guessFieldTypeFromValue(first_value),
              });
            }
          }
          let ts_set = new Set();
          //TODO: Figure out how to get rid of need for ignoring linting errors here. How to declare types?
          // @ts-ignore
          entries.map((x) => x[1]['value'].map(y => y[0])).flat().forEach(x => ts_set.add(x));
          let data_map = {}
          // @ts-ignore
          ts_set.forEach(x => data_map[x] = Object.fromEntries([['Time', x]].concat(entries.map(x => [x[0].split('/').slice(unique_seg).join('/') || '', null]))));
          // @ts-ignore
          entries.map((x, i) => x[1]['value'].forEach(y => data_map[y[0]][x[0].split('/').slice(unique_seg).join('/') || ''] = y[1]))
          Object.entries(data_map).forEach(x => frame.add(x[1]))
          subscriber.next({
            data: [frame],
            key: query.refId,
          });
        },
        error(err) {
          console.log('ERROR FROM process_historian_ts.subscribe(): ' + err);
        },
        complete() {
          subscriber.complete();
        },
      });
    });
  }

  process_device_ts(
    query: MyQuery,
    options: DataQueryRequest,
    response: Observable<FetchResponse>
  ): Observable<DataQueryResponse> {
    console.log('IN PROCESS_DEVICE_TS');
    return new Observable<DataQueryResponse>((subscriber) => {
      const frame = new CircularDataFrame({
        append: 'tail',
        capacity: 1,
      });
      response.pipe(filter((x) => isEmpty(x.data.route_options))).subscribe({
        next(x) {
          const entries: any = Object.entries(x.data);
          const unique_seg = first_unique_segment(entries);
          if (frame.fields.length === 0) {
            frame.refId = query.refId;
            frame.addField({ name: 'Time', type: FieldType.time });
            for (const [topic, data] of entries) {
              const field_name = topic.split('/').slice(unique_seg).join('/') || '';
              const first_value = data.value;
              frame.addField({
                name: field_name,
                type: guessFieldTypeFromValue(first_value),
              });
            }
          }
          const row: any = {};
          row['Time'] = Date.now();
          for (let topic in x.data) {
            if (!['metadata', 'units', 'type', 'tz'].includes(topic)) {
              const field_name = topic.split('/').slice(unique_seg).join('/') || '';
              row[field_name] = x.data[topic]['value'];
            }
          }
          frame.add(row);
          subscriber.next({
            data: [frame],
            key: query.refId,
          });
        },
        error(err) {
          console.log('ERROR FROM process_device_ts.subscribe(): ' + err);
        },
        complete() {
          subscriber.complete();
        },
      });
    });
  }

  process_pubsub_ts(
    query: MyQuery,
    options: DataQueryRequest,
    response: Observable<FetchResponse>
  ): Observable<DataQueryResponse> {
    console.log('IN PROCESS_PUBSUB_TS');
    return new Observable<DataQueryResponse>((subscriber) => {
      console.log('IN RETURN NEW OBSERVABLE');
      const frame = new CircularDataFrame({
        append: 'tail',
        capacity: 10,
      });
      response.pipe(filter((x) => isEmpty(x.data.route_options))).subscribe({
        next(x) {
          console.log('In process_pubsub_ts, next(x) is: ');
          console.log(x);
          if (frame.fields.length === 0) {
            frame.refId = query.refId;
            frame.addField({ name: 'Time', type: FieldType.time });
            frame.addField({ name: 'Value', type: FieldType.string }); // TODO: Fix this.
            // const field_name = entries[0][0].split('/').slice(-1).pop() || '';
            // const first_value = entries[0][1].value;
            // frame.addField({
            //   name: field_name,
            //   type: guessFieldTypeFromValue(first_value),
            // });
          }
          for (const topic in x.data) {
            if (!['metadata', 'units', 'type', 'tz'].includes(topic)) {
              const field_name = topic.split('/').slice(-1).pop() || '';
              frame.add({
                Time: Date.now(),
                [field_name]: x.data[topic]['value'],
              });
              console.log('frame is: ');
              console.log(frame);
              subscriber.next({
                data: [frame],
                key: query.refId,
              });
            }
          }
        },
        error(err) {
          console.log('ERROR FROM process_device_ts.subscribe(): ' + err);
        },
        complete() {
          subscriber.complete();
        },
      });
    });
  }

  register_query_routes_callback(route_setter: (route_options: any, segment_number: number) => void) {
    this.route_update_callback = (path?: string) => {
      return (options_response: any) => {
        const segment_number = path && path.split('/').length >= 1 ? path.split('/').length - 1 : 0;
        route_setter(options_response.data.route_options, segment_number);
      };
    };
  }

  query(options: DataQueryRequest<MyQuery>): any /*Observable<DataQueryResponse>*/ {
    const observables = options.targets.map((target) => {
      //let return_list: Observable<DataQueryResponse>[] = [];
      const query = defaults(target, defaultQuery);

      if (query.http_method === 'GET') {
        if (query.route?.match(/^\/platforms\/.+\/pubsub\/?$/)) {
          query.route = query.route + '/devices/Campus/Building1/Fake1/all';
        }
        if (query.route?.match(/^\/platforms\/.+\/pubsub\/.+\/?$/)) {
          const response = this.doRequest(query, 'websocket');
          // this.alert_on_error(response);
          // this.log_all_nexts(response);
          return this.process_pubsub_ts(query, options, response);
        } else {
          // this.alert_on_error(response);
          // this.log_all_nexts(response);
          if (query.route?.match(/^\/platforms\/.+\/historians\/.+\/topics\/.+\/?$/)) {
            if (options.range) {
              query.route = query.route + '?start=' + options.range.from?.format();
              query.route = query.route + '&end=' + options.range.to?.format();
              query.route = query.route + '&count=' + options.maxDataPoints;
              query.route = query.route + '&order=' + 'FIRST_TO_LAST';
              // query.route = query.route + '&' + query.query_params;
              if (query.query_params) {
                query.route = query.route + '&' + query.query_params;
              }
            }
            const response = this.doRequest(query, 'http');
            const routes_observable = this.process_route_options(query, options, response);
            return routes_observable.pipe(merge(this.process_historian_ts(query, options, response)));
          } else if (query.route?.match(/^\/platforms\/.+\/devices\/.+\/?$/)) {
            query.route = query.route + '?' + query.query_params;
            const response = this.doRequest(query, 'http');
            const routes_observable = this.process_route_options(query, options, response);
            return routes_observable.pipe(merge(this.process_device_ts(query, options, response)));
          } else if (query.route?.match(/^\/platforms\/.+\/agents\/.+\/rpc\/.+\/?$/)) {
            const response = this.doRequest(query, 'http');
            const routes_observable = this.process_route_options(query, options, response);
            return routes_observable.pipe(merge(this.process_platform_agents_rpc_method(query, options, response)));
          } else {
            const response = this.doRequest(query, 'http');
            const routes_observable = this.process_route_options(query, options, response);
            return routes_observable.pipe(merge(this.process_generic(query, options, response)));
          }
        }
      } else {
        const response = this.doRequest(query, 'http');
        return this.process_generic(query, options, response);
      }
    });
    console.log('observables is:');
    console.log(observables);
    return observables[0];
  }

  _empty_data_frame_observable(query: MyQuery) {
    return new Observable<DataQueryResponse>((subscriber) => {
      const frame = new MutableDataFrame({
        refId: query.refId,
        fields: [{ name: ' ', type: FieldType.other }],
      });
      frame.add({ ' ': 'No data' });
      subscriber.next({
        data: [frame],
        key: query.refId,
      });
      subscriber.complete();
    });
  }

  async testDatasource() {
    // Implement a health check for your data source.
    return {
      status: 'success',
      message: 'Success',
    };
  }
}
