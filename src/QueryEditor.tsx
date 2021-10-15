import defaults from 'lodash/defaults';

import React, { /*ChangeEvent,*/ PureComponent } from 'react';
import { /*LegacyForms,*/ Select, Label } from '@grafana/ui';
import { QueryEditorProps, SelectableValue, DataQueryRequest } from '@grafana/data';
import { DataSource } from './datasource';
import { defaultQuery, MyDataSourceOptions, MyQuery } from './types';
import { cloneDeep } from 'lodash';
//import { parse } from '@grafana/data/datetime/datemath';

//const { FormField } = LegacyForms;

type MyState = { route_options: any; historian: any; devices: any; pubs: any; agents: any };

type Props = QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions>;

// type MyState = { route_options: any };

export class QueryEditor extends PureComponent<Props, MyState> {
  constructor(props: Props) {
    super(props);
    this.props.datasource.register_query_routes_callback(this.update_query_routes);
    let segments = this.props.query.route?.split('/');

    if (segments) {
      if (segments[0] === '') {
        segments.shift();
      }
    } else {
      segments = [];
    }
    console.log('at start, in constructor, segments has: ');
    console.log(segments);
    this.props.onRunQuery();

    let q_param_entries = this.props.query.query_params?.split('&').map((p) => p.split('='));
    let q_params = q_param_entries ? Object.fromEntries(q_param_entries) : {};
    console.log('q_params is: ');
    console.log(q_params);
    this.state = {
      devices: {
        tag: q_params.tag || '',
        regex: q_params.regex || '',
        read_all: q_params['read-all'] === 'true',
      },
      historian: {
        tag: q_params.tag || '',
        regex: q_params.regex || '',
        read_all: q_params['read-all'] === 'true',
        write_all: q_params['write-all'] === 'true',
      },
      pubs: {
        topic: q_params.topic || '',
      },
      agents: {
        running: q_params.running === 'true',
        packaged: q_params.packaged === 'true',
        installed: q_params.installed === 'true',
      },
      route_options: {
        current_route: segments,
        segments: {
          // '0': ['platforms', 'devices', 'pubsub'],
          // '1': ['platform_name1'],
        },
      },
    };

    let datasrc = this.props.datasource;
    let q = {
      refId: this.props.datasource.id.toString(),
      http_method: 'GET',
      route: '',
    } as MyQuery;
    let request = {} as DataQueryRequest;
    request.targets = [q];
    datasrc.query(request);
    segments.forEach((seg: any, indx: any) => {
      let request = {} as DataQueryRequest;
      request.targets = [q];
      q.route = q.route?.split('?')[0] + '/' + seg;
      datasrc.query(request);
    });
  }

  onRouteChange = (segment: SelectableValue<string>, index: any) => {
    index = parseInt(index, 10);
    const { onChange, query, onRunQuery } = this.props;
    let new_route_opts = cloneDeep(this.state.route_options);
    if (index < new_route_opts.current_route.length) {
      new_route_opts.current_route = new_route_opts.current_route.slice(0, index);
      new_route_opts.current_route.push(segment.value);
    } else if (index === new_route_opts.current_route.length) {
      new_route_opts.current_route.push(segment.value);
    }
    Object.keys(new_route_opts.segments).forEach((key: string) => {
      if (parseInt(key, 10) > index && new_route_opts.segments[key]) {
        delete new_route_opts.segments[key];
      }
    });
    onChange({ ...query, route: '/' + new_route_opts.current_route.join('/') });
    onRunQuery();
    this.setState({ route_options: new_route_opts });
  };

  onMethodChange = (method_value: SelectableValue<string>) => {
    const { onChange, query, onRunQuery } = this.props;
    onChange({ ...query, http_method: method_value.value });
    // executes the query
    onRunQuery();
  };

  update_query_routes = (route_options: any, segment_number: number) => {
    let state_copy = cloneDeep(this.state);
    state_copy.route_options.segments[segment_number /*new_key*/] = Object.keys(route_options);
    this.setState(state_copy);
    this.forceUpdate();
  };

  generateSelectBox = () => {
    const segments = this.state.route_options.segments;
    const current_route = this.state.route_options.current_route;
    const topic_segment =
      current_route.indexOf('topics') >= 0 ? current_route.indexOf('topics') : current_route.indexOf('devices');
    return Object.keys(segments).map((index: string) => {
      const route_options =
        topic_segment >= 0 && index > topic_segment ? ['-'].concat(segments[index].sort()) : segments[index].sort();
      return (
        <Select
          key={index}
          options={route_options.map((x: string) => {
            return { label: x, value: x };
          })}
          value={this.state.route_options.current_route[parseInt(index, 10)]}
          width={15}
          onChange={(v) => {
            this.onRouteChange(v, index);
          }}
        />
      );
    });
  };

  handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const target = event.target;
    const value = target.type === 'checkbox' ? target.checked : target.value;
    const name = target.name;
    //this.state.route_options.current_route.includes('historians')
    let current_route = this.state.route_options.current_route;
    let state_copy = cloneDeep(this.state);
    if (current_route.includes('historians')) {
      if (name === 'tag') {
        state_copy.historian.tag = value;
      }
      if (name === 'regex') {
        state_copy.historian.regex = value;
      }
      if (name === 'read_all') {
        state_copy.historian.read_all = value;
      }
      if (name === 'write_all') {
        state_copy.historian.write_all = value;
      }
    }
    if (current_route.includes('devices')) {
      if (name === 'tag') {
        state_copy.devices.tag = value;
      }
      if (name === 'regex') {
        state_copy.devices.regex = value;
      }
      if (name === 'read_all') {
        state_copy.devices.read_all = value;
      }
    }
    if (current_route.includes('agents')) {
      if (name === 'installed') {
        state_copy.agents.installed = value;
      }
      if (name === 'packaged') {
        state_copy.agents.packaged = value;
      }
      if (name === 'running') {
        state_copy.agents.running = value;
      }
    }

    if (current_route.includes('pubsub')) {
      if (name === 'topic') {
        state_copy.pubs.topic = value;
      }
    }
    this.setState(state_copy);
  };

  update_query_params = (event: any) => {
    let historian_query_parameters = this.state.historian;
    let current_route = this.state.route_options.current_route;
    if (current_route.includes('historians')) {
      this.props.query.query_params =
        'tag=' +
        encodeURIComponent(historian_query_parameters.tag) +
        '&regex=' +
        encodeURIComponent(historian_query_parameters.regex) +
        '&' +
        'read-all=' +
        encodeURIComponent(historian_query_parameters.read_all) +
        '&' +
        'write-all=' +
        encodeURIComponent(historian_query_parameters.write_all);
    }
    let devices_query_params = this.state.devices;
    if (current_route.includes('devices')) {
      this.props.query.query_params =
        'tag=' +
        encodeURIComponent(devices_query_params.tag) +
        '&regex=' +
        encodeURIComponent(devices_query_params.regex) +
        '&read-all=' +
        encodeURIComponent(devices_query_params.read_all);
    }
    let agents_query_params = this.state.agents;
    if (current_route.includes('agents')) {
      this.props.query.query_params =
        'running=' +
        encodeURIComponent(agents_query_params.running) +
        '&packaged=' +
        encodeURIComponent(agents_query_params.packaged) +
        '&installed=' +
        encodeURIComponent(agents_query_params.installed);
    }
    let pubsub_query_params = this.state.pubs;
    if (current_route.includes('pubsub')) {
      this.props.query.query_params = 'topic=' + encodeURIComponent(pubsub_query_params.topic);
    }
    this.props.onRunQuery();
  };

  generate_query_parameter_elements() {
    if (this.state.route_options.current_route.includes('historians')) {
      return (
        <form onSubmit={this.update_query_params}>
          <div style={{ whiteSpace: 'pre-wrap' }}>
            <label>Tag</label>
            <input
              type="text"
              name="tag"
              value={this.state.historian.tag}
              onChange={(v) => {
                this.handleChange(v);
              }}
            />
            {'  '}
            <label>Regex</label>
            <input
              type="text"
              name="regex"
              value={this.state.historian.regex}
              onChange={(v) => {
                this.handleChange(v);
              }}
            />
            {this.props.query.http_method === 'GET' && (
              <label>
                <input
                  type="checkbox"
                  name="read_all"
                  checked={this.state.historian.read_all}
                  onChange={(v) => {
                    this.handleChange(v);
                  }}
                />
                read-all
              </label>
            )}
            {this.props.query.http_method === 'PUT' ||
              (this.props.query.http_method === 'DELETE' && (
                <label>
                  <input
                    type="checkbox"
                    name="write_all"
                    checked={this.state.historian.write_all}
                    onChange={(v) => {
                      this.handleChange(v);
                    }}
                  />
                  write-all
                </label>
              ))}
            {'   '}
            <input type="button" value="Submit" height={55} onClick={this.update_query_params} />
          </div>
        </form>
      );
    } else if (this.state.route_options.current_route.includes('devices')) {
      return (
        <form onSubmit={this.update_query_params}>
          <div style={{ whiteSpace: 'pre-wrap' }}>
            <label>Tag</label>
            <input
              type="text"
              name="tag"
              value={this.state.devices.tag}
              onChange={(v) => {
                this.handleChange(v);
              }}
            />
            <label>Regex</label>
            <input
              type="text"
              name="regex"
              value={this.state.devices.regex}
              onChange={(v) => {
                this.handleChange(v);
              }}
            />
            {this.props.query.http_method === 'GET' && (
              <label>
                read-all
                <input
                  type="checkbox"
                  name="read_all"
                  checked={this.state.devices.read_all}
                  onChange={(v) => {
                    this.handleChange(v);
                  }}
                />
              </label>
            )}
            {this.props.query.http_method === 'PUT' ||
              (this.props.query.http_method === 'DELETE' && (
                <label>
                  write-all
                  <input
                    type="checkbox"
                    name="write_all"
                    checked={this.state.devices.write_all}
                    onChange={(v) => {
                      this.handleChange(v);
                    }}
                  />
                </label>
              ))}
            {'   '}
            <input type="button" value="Submit" height={55} onClick={this.update_query_params} />
          </div>
        </form>
      );
    } else if (this.state.route_options.current_route.includes('agents')) {
      return (
        <form onSubmit={this.update_query_params}>
          <div style={{ whiteSpace: 'pre-wrap' }}>
            <label>
              <input
                type="checkbox"
                name="running"
                value={this.state.agents.running}
                onChange={(v) => {
                  this.handleChange(v);
                }}
              />
              Running
            </label>
            {'  '}
            <label>
              <input
                type="checkbox"
                name="installed"
                value={this.state.agents.installed}
                onChange={(v) => {
                  this.handleChange(v);
                }}
              />
              Installed
            </label>
            {'  '}
            <label>
              <input
                type="checkbox"
                name="packaged"
                value={this.state.agents.packaged}
                onChange={(v) => {
                  this.handleChange(v);
                }}
              />
              Packaged
            </label>
            {'   '}
            <input type="button" value="Submit" height={55} onClick={this.update_query_params} />
          </div>
        </form>
      );
    } else if (this.state.route_options.current_route.includes('pubsub')) {
      return (
        <form onSubmit={this.update_query_params}>
          <div style={{ whiteSpace: 'pre-wrap' }}>
            <label>Topic</label>
            <input
              type="input"
              name="topic"
              value={this.state.pubs.topic}
              onChange={(v) => {
                this.handleChange(v);
              }}
            />
            {'   '}
            <input type="button" value="Submit" height={55} onClick={this.update_query_params} />
          </div>
        </form>
      );
    } else {
      return '';
    }
  }

  render() {
    const query = defaults(this.props.query, defaultQuery);
    const { http_method } = query;
    const method_options = [
      { label: 'GET', value: 'GET' },
      { label: 'POST', value: 'POST' },
      { label: 'PUT', value: 'PUT' },
      { label: 'DELETE', value: 'DELETE' },
    ];

    return (
      // TODO: Label does not appear in the same style as that of the FormField.
      <div>
        <div className="gf-form">
          <Label>HTTP Method</Label>
          <Select
            options={method_options}
            value={http_method}
            width={15}
            onChange={(v) => {
              this.onMethodChange(v);
            }}
          />
          {this.generateSelectBox()}
        </div>
        {this.generate_query_parameter_elements()}
      </div>
    );
  }
}
