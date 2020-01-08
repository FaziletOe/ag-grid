import { CartesianChart } from "./cartesianChart";
import { NumberAxis } from "./axis/numberAxis";
import { CategoryAxis } from "./axis/categoryAxis";
import { LineSeries } from "./series/cartesian/lineSeries";
import { ColumnSeries } from "./series/cartesian/columnSeries";
import { BarSeries } from "./series/cartesian/barSeries";
import { ScatterSeries } from "./series/cartesian/scatterSeries";
import { AreaSeries } from "./series/cartesian/areaSeries";
import { PolarChart } from "./polarChart";
import { PieSeries } from "./series/polar/pieSeries";
import { Caption } from "../caption";
import { Legend } from "./legend";
import { Padding } from "../util/padding";

const mappings = {
    cartesian: {
        constructor: CartesianChart, // Constructor function for the `cartesian` type.
        // Charts components' constructors normally don't take any parameters (which makes things consistent -- everything
        // is configured the same way, via the properties, and makes the factory pattern work well) but the charts
        // themselves are the exceptions.
        // If a chart config has the (optional) `document` property, it will be passed to the constructor.
        // There is no actual `document` property on the chart, it can only be supplied during instantiation.
        constructorParams: ['document'], // Config object properties to be used as constructor parameters, in that order.
        exclude: ['parent', 'data'], // Properties that should be set on the component as is (without pre-processing).
        defaults: { // These values will be used if properties in question are not in the config object.
            axes: [{
                type: 'category',
                position: 'bottom'
            }, {
                type: 'number',
                position: 'left'
            }]
        },
        padding: {
            constructor: Padding
        },
        title: {
            constructor: Caption
        },
        subtitle: {
            constructor: Caption
        },
        axes: {
            number: {
                constructor: NumberAxis,
                label: {},
                tick: {}
            },
            category: {
                constructor: CategoryAxis,
                label: {},
                tick: {}
            }
        },
        series: {
            line: {
                constructor: LineSeries,
                marker: {}
            },
            column: {
                constructor: ColumnSeries
            },
            bar: {
                constructor: BarSeries
            },
            scatter: {
                constructor: ScatterSeries,
                marker: {}
            },
            area: {
                constructor: AreaSeries,
                marker: {}
            }
        },
        legend: {
            constructor: Legend
        }
    },
    polar: {
        constructor: PolarChart,
        constructorParams: ['document'],
        defaults: {
            parent: document.body
        },
        series: {
            pie: {
                constructor: PieSeries
            }
        },
        legend: {
            constructor: Legend
        }
    }
} as any;

function getMapping(path: string) {
    const parts = path.split('.');
    let value = mappings;
    parts.forEach(part => {
        value = value[part];
    });
    return value;
}

export abstract class AgChart {
    static create(options: any) {
        return AgChart._create(Object.create(options)); // avoid mutating user provided options
    }

    static update(chart: any, options: any) {
        return AgChart._update(chart, Object.create(options));
    }

    private static setChartType(options: any) {
        // If chart type is not specified, try to infer it from the type of first series.
        if (!options.type) {
            const series = options.series && options.series[0];

            if (series && series.type) {
                outerLoop: for (const chartType in mappings) {
                    for (const seriesType in mappings[chartType].series) {
                        if (series.type === seriesType) {
                            options.type = chartType;
                            break outerLoop;
                        }
                    }
                }
            }
            if (!options.type) {
                options.type = 'cartesian';
            }
        }
    }

    private static setComponentType(options: any, path?: string) {
        if (!path) { // if `path` is undefined, `options` is a top-level (chart) config
            AgChart.setChartType(options);
        }

        // Default series type for cartesian charts.
        if (path === 'cartesian.series' && !options.type) {
            options.type = 'line';
        }

        // Default series type for polar charts.
        if (path === 'polar.series' && !options.type) {
            options.type = 'pie';
        }
    }

    private static setComponentDefaults(options: any, mapping: any) {
        const { defaults } = mapping;

        // If certain options were not provided by the user, use the defaults from the mapping.
        if (defaults) {
            for (const key in defaults) {
                if (!options[key]) {
                    options[key] = defaults[key];
                }
            }
        }
    }

    private static _create(options: any, path?: string, component?: any) {
        if (!(options && typeof options === 'object')) {
            return;
        }

        AgChart.setComponentType(options, path);

        if (path) {
            if (options.type) {
                path = path + '.' + options.type;
            }
        } else {
            path = options.type;
        }

        const mapping = getMapping(path);

        if (mapping) {
            AgChart.setComponentDefaults(options, mapping);
            const constructorParams = mapping.constructorParams || [];
            // TODO: Constructor params processing could be improved, but it's good enough for current params.
            const constructorParamValues = constructorParams.map((param: any) => options[param]).filter((value: any) => value !== undefined);
            component = component || new mapping.constructor(...constructorParamValues);

            for (const key in options) {
                // Process every non-special key in the config object.
                if (key !== 'type' && constructorParams.indexOf(key) < 0) {
                    const value = options[key];

                    if (key in mapping && !(mapping.exclude && mapping.exclude.indexOf(key) >= 0)) {
                        if (Array.isArray(value)) {
                            const subComponents = value.map(config => AgChart._create(config, path + '.' + key)).filter(config => !!config);
                            component[key] = subComponents;
                        } else {
                            if (mapping[key] && component[key]) {
                                // The instance property already exists on the component (e.g. chart.legend).
                                // Simply configure the existing instance, without creating a new one.
                                AgChart._create(value, path + '.' + key, component[key]);
                            } else {
                                const subComponent = AgChart._create(value, value.type ? path : path + '.' + key);
                                if (subComponent) {
                                    component[key] = subComponent;
                                }
                            }
                        }
                    } else {
                        component[key] = value;
                    }
                }
            }
            return component;
        }
    }

    private static _update(component: any, options: any, path?: string) {
        if (!(options && typeof options === 'object')) {
            return;
        }

        AgChart.setComponentType(options, path);

        if (path) {
            if (options.type) {
                path = path + '.' + options.type;
            }
        } else {
            path = options.type;
        }

        const mapping = getMapping(path);

        if (mapping) {
            if (!(component instanceof mapping.constructor)) {
                return;
            }

            AgChart.setComponentDefaults(options, mapping);
        }

        if (options.legend) {
            for (const key in Legend.defaults) {
                if (key in options.legend) {
                    component.legend[key] = options.legend[key];
                } else {
                    component.legend[key] = (Legend.defaults as any)[key];
                }
            }
        }
    }
};