import defaults from 'lodash/defaults';

import React, { ChangeEvent, PureComponent } from 'react';
import { LegacyForms, Select, Label } from '@grafana/ui';
import { QueryEditorProps, SelectableValue } from '@grafana/data';
import { DataSource } from './datasource';
import { defaultQuery, MyDataSourceOptions, MyQuery } from './types';

const { FormField } = LegacyForms;

type Props = QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions>;

export class QueryEditor extends PureComponent<Props> {
  onRouteChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onChange, query, onRunQuery } = this.props;
    onChange({ ...query, route: event.target.value });
    onRunQuery();
  };

  onMethodChange = (method_value: SelectableValue<string>) => {
    const { onChange, query, onRunQuery } = this.props;
    onChange({ ...query, http_method: method_value.value });
    // executes the query
    onRunQuery();
  };

  render() {
    const query = defaults(this.props.query, defaultQuery);
    const { route, http_method } = query;
    const method_options = [
      { label: 'GET', value: 'GET' },
      { label: 'POST', value: 'POST' },
      { label: 'PUT', value: 'PUT' },
      { label: 'DELETE', value: 'DELETE' },
    ];

    return (
      // TODO: Label does not appear in the same style as that of the FormField.
      <div className="gf-form">
        <Label>HTTP Method</Label>
        <Select
          options={method_options}
          value={http_method}
          width={15}
          onChange={v => {
            this.onMethodChange(v);
          }}
        />
        {/* TODO: The Route should be a datasource Segment field that loads the next segment from API calls.*/}
        <FormField
          labelWidth={8}
          value={route || ''}
          onChange={this.onRouteChange}
          label="Route"
          tooltip="VOLTTRON UI API Route"
        />
      </div>
    );
  }
}
