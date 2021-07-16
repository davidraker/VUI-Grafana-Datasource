import defaults from 'lodash/defaults';

import React, { /*ChangeEvent,*/ PureComponent} from 'react';
import { /*LegacyForms,*/ Select, Label} from '@grafana/ui';
import {QueryEditorProps, SelectableValue} from '@grafana/data';
import {DataSource} from './datasource';
import {defaultQuery, MyDataSourceOptions, MyQuery} from './types';
import {cloneDeep} from 'lodash';
//import { parse } from '@grafana/data/datetime/datemath';

//const { FormField } = LegacyForms;

type Props = QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions>;

type MyState = { route_options: any };

export class QueryEditor extends PureComponent<Props, MyState> {
    constructor(props: Props) {
        super(props);
        this.props.datasource.register_query_routes_callback(this.update_query_routes);
        this.props.onRunQuery();
        this.state = {
            route_options: {
                current_route: [],
                segments: {
                    // '0': ['platforms', 'devices', 'pubsub'],
                    // '1': ['suba'],
                },
            },
        };
    }

    onRouteChange = (segment: SelectableValue<string>, index: any) => {
        index = parseInt(index, 10)
        console.log('onRouteChange index is:', index)
        console.log('onRouteChange segment is: ', segment)
        const {onChange, query, onRunQuery} = this.props;
        let new_route_opts = cloneDeep(this.state.route_options)
        if (index < new_route_opts.current_route.length) {
            console.log('index < new_route_opts.current_route.length')
            new_route_opts.current_route = new_route_opts.current_route.slice(0, index)
            new_route_opts.current_route.push(segment.value)
        } else if (index === new_route_opts.current_route.length) {
            console.log('index = new_route_opts.current_route.length')
            new_route_opts.current_route.push(segment.value);
            console.log('this.sstate.route_options.current_lenth is: ', new_route_opts.current_route)
        }
        Object.keys(new_route_opts.segments).forEach((key: string) => {
            if (parseInt(key, 10) > index && new_route_opts.segments[key]) {
                console.log('after deletion')
                delete new_route_opts.segments[key];
                console.log(new_route_opts.segments)
            }
        });
        console.log('current_route is: ', new_route_opts.current_route)
        console.log('route will be :', '/' + new_route_opts.current_route.join('/'))
        onChange({...query, route: '/' + new_route_opts.current_route.join('/')});
        console.log('after onChange')
        onRunQuery();
        console.log('after onRunQuery')
        this.setState({route_options: new_route_opts})
        console.log('after setState')
        console.log('new_route_opts is: ')
        console.log(new_route_opts)
        console.log('state.route_options is: ')
        console.log(this.state.route_options)
    };

    onMethodChange = (method_value: SelectableValue<string>) => {
        const {onChange, query, onRunQuery} = this.props;
        onChange({...query, http_method: method_value.value});
        // executes the query
        onRunQuery();
    };

    update_query_routes = (route_options: any, segment_number: number) => {
        console.log('route options callback is set, and received: ');
        console.log(route_options);
        console.log('STATE route options is:" ')
        console.log(this.state.route_options)
        //const new_key = this.state.route_options.current_route.length.toString(10);
        console.log('new_key from callback', segment_number /*new_key, this.state.route_options.current_route.length*/)
        //if (this.state.route_options.current_route.length == segment_number /*parseInt(new_key)*/){
        this.state.route_options.segments[segment_number /*new_key*/] = Object.keys(route_options);

        //}
        //console.log(Object.keys(route_options))
        //console.log('after')
        console.log('this.state.route_options.segments:', this.state.route_options.segments)
        console.log('this.state.route_options.current_route', this.state.route_options.current_route)
        this.forceUpdate();
        //this.setState({route_options.segments[new_key]: Object(route_options).keys()});
    };

    generateSelectBox = () => {
        return Object.keys(this.state.route_options.segments).map((index: string) => {
            const route_options = this.state.route_options.segments[index];
            console.log('index')
            console.log(index)
            console.log('route_options from generate box')
            console.log(route_options)
            return (
                <Select
                    options={route_options.map((x: string) => {
                        return {label: x, value: x};
                    })}
                    value={this.state.route_options.current_route[parseInt(index, 10)]}
                    width={15}
                    onChange={v => {
                        this.onRouteChange(v, index);
                    }}
                />
            );
        });
    }

    render() {
        const query = defaults(this.props.query, defaultQuery);
        const {http_method} = query;
        const method_options = [
            {label: 'GET', value: 'GET'},
            {label: 'POST', value: 'POST'},
            {label: 'PUT', value: 'PUT'},
            {label: 'DELETE', value: 'DELETE'},
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

                {this.generateSelectBox()}
            </div>
        );
    }
}
