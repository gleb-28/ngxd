import { ChangeDetectorRef, ComponentFactory, ComponentRef, DoCheck, OnChanges, OnInit, SimpleChange, SimpleChanges } from '@angular/core';
import { Subscription } from 'rxjs';

const PRIVATE_PREFIX = '__ngxOnChanges_';

type OnChangesExpando = OnChanges & {
    __ngOnChanges_: SimpleChanges | null | undefined;
    [ key: string ]: any;
};

export type LifecycleComponent = OnInit & DoCheck | OnInit | DoCheck | any;

interface ComponentProperty {
    propName: string;
    templateName: string;
}

interface DefaultComponentProperty extends ComponentProperty {
    defaultDescriptor: PropertyDescriptor;
}

function onChangesWrapper(delegateHook: (() => void) | null) {
    return function(this: OnChangesExpando) {
        const simpleChanges = this[ PRIVATE_PREFIX ];

        if (simpleChanges != null) {
            if (this.ngOnChanges) {
                this.ngOnChanges(simpleChanges);
            }
            this[ PRIVATE_PREFIX ] = null;
        }

        if (delegateHook) {
            delegateHook.apply(this);
        }
    };
}

function markForCheckWrapper(delegateHook: (() => void) | null, cd) {
    return function(this) {
        if (delegateHook) {
            delegateHook.apply(this);
        }

        if (cd) {
            cd.markForCheck();
        }
    };
}

export interface NgxComponentOutletAdapterRefConfig<TComponent> {
    componentFactory: ComponentFactory<TComponent>;
    componentRef: ComponentRef<TComponent>;
    context: TComponent;
    onInitComponentRef?: ComponentRef<LifecycleComponent>;
    doCheckComponentRef?: ComponentRef<LifecycleComponent>;
}

export class NgxComponentOutletAdapterRef<TComponent> {

    componentFactory: ComponentFactory<TComponent>;
    componentRef: ComponentRef<TComponent>;
    context: TComponent;

    private onInitComponentRef: ComponentRef<LifecycleComponent>;
    private doCheckComponentRef: ComponentRef<LifecycleComponent>;
    private changeDetectorRef: ChangeDetectorRef;
    private attachedOutputs: Subscription[] = [];
    private defaultDescriptors: DefaultComponentProperty[] = [];

    constructor(config: NgxComponentOutletAdapterRefConfig<TComponent>) {
        this.componentFactory = config.componentFactory;
        this.componentRef = config.componentRef;
        this.context = config.context;
        this.onInitComponentRef = config.onInitComponentRef || this.componentRef as any;
        this.doCheckComponentRef = config.doCheckComponentRef || this.componentRef as any;
        this.changeDetectorRef = this.componentRef.injector.get(ChangeDetectorRef, this.componentRef.changeDetectorRef);

        this.attachInputs();
        this.attachLifecycle();
        this.attachOutputs();
    }

    dispose(): void {
        this.disposeOutputs();
        this.disposeInputs();

        if (this.componentRef) {
            this.componentRef.destroy();
            this.componentRef = null;
        }

        if (this.onInitComponentRef) {
            this.onInitComponentRef.destroy();
            this.onInitComponentRef = null;
        }

        if (this.doCheckComponentRef) {
            this.doCheckComponentRef.destroy();
            this.doCheckComponentRef = null;
        }
    }

    private attachInputs(): void {
        const inputs: ComponentProperty[] = this.componentFactory.inputs;

        this.defaultDescriptors = inputs.map((property: ComponentProperty): DefaultComponentProperty => {
            const defaultDescriptor: PropertyDescriptor = Object.getOwnPropertyDescriptor(this.context, property.templateName);

            this.attachInput(this.context, this.componentRef.instance, property, defaultDescriptor);

            return { ...property, defaultDescriptor };
        });
    }

    private attachInput(
        context: TComponent, instance: TComponent,
        { propName, templateName }: ComponentProperty,
        defaultDescriptor: PropertyDescriptor
    ) {
        const defaultValue = context[ templateName ];

        Object.defineProperty(context, templateName, {
            get: () => {
                if (defaultDescriptor && defaultDescriptor.get) {
                    defaultDescriptor.get.call(context);
                } else {
                    return instance[ propName ];
                }
            },
            set: (value: any) => {
                let simpleChanges = instance[ PRIVATE_PREFIX ];
                const isFirstChange = simpleChanges === undefined;

                if (simpleChanges == null) {
                    simpleChanges = instance[ PRIVATE_PREFIX ] = {};
                }

                simpleChanges[ templateName ] = new SimpleChange(instance[ propName ], value, isFirstChange);

                if (defaultDescriptor && defaultDescriptor.set) {
                    defaultDescriptor.set.call(context, value);
                } else {
                    instance[ propName ] = value;
                }
            }
        });

        if (typeof defaultValue !== 'undefined') {
            context[ templateName ] = defaultValue;
        }
    }

    private attachLifecycle(): void {
        const instance: TComponent & LifecycleComponent = this.componentRef.instance as any;

        if (this.componentRef.componentType.prototype.hasOwnProperty('ngOnChanges')) {
            const markForCheckWrapped = markForCheckWrapper(instance.ngDoCheck, this.changeDetectorRef);

            this.onInitComponentRef.instance.ngOnInit = onChangesWrapper(instance.ngOnInit).bind(instance);
            this.doCheckComponentRef.instance.ngDoCheck = onChangesWrapper(markForCheckWrapped).bind(instance);
        } else {
            this.doCheckComponentRef.instance.ngDoCheck = markForCheckWrapper(instance.ngDoCheck, this.changeDetectorRef);
        }
    }

    private disposeInputs(): void {
        const instance: TComponent & LifecycleComponent = this.componentRef.instance as any;

        this.defaultDescriptors.forEach(({ propName, templateName, defaultDescriptor }) => {
            if (defaultDescriptor) {
                Object.defineProperty(this.context, templateName, defaultDescriptor);
            } else {
                delete this.context[ templateName ];
                this.context[ templateName ] = instance[ propName ];
            }
        });
    }

    private attachOutputs(): void {
        const availableOutputs: ComponentProperty[] = this.componentFactory.outputs.filter(
            (property: ComponentProperty) => this.context.hasOwnProperty(property.templateName));

        this.attachedOutputs = availableOutputs.map((property: ComponentProperty) =>
            this.componentRef.instance[ property.propName ].subscribe(this.context[ property.templateName ]));
    }

    private disposeOutputs(): void {
        this.attachedOutputs.splice(0).forEach((subscription) => subscription.unsubscribe());
    }

}
