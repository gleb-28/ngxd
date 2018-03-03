import { InjectionToken, ModuleWithProviders, NgModule, Optional, Type } from '@angular/core';
import { Archer, HeroBase, HeroTypes, Warrior, Wizard } from '@app/domain/heroes';

import { HeroFactory } from './hero.factory';
import { HeroDataService } from './hero.service';

export type HeroProvider = [ HeroTypes, Type<HeroBase> ];

export const HEROES_PROVIDER: InjectionToken<HeroProvider[]> =
    new InjectionToken<HeroProvider[]>('Heroes Provider');

@NgModule({})
export class HeroFactoryModule {

    static forRoot(type: HeroTypes, factory: Type<HeroBase>): ModuleWithProviders {
        return {
            ngModule: HeroFactoryModule,
            providers: [ {
                provide: HeroFactory,
                useClass: HeroFactory,
                deps: [ [ new Optional(), HEROES_PROVIDER ] ]
            }, {
                provide: HEROES_PROVIDER,
                useValue: [ type, factory ],
                multi: true
            } ]
        };
    }

    static forFeature(type: HeroTypes, factory: Type<HeroBase>): ModuleWithProviders {
        return {
            ngModule: HeroFactoryModule,
            providers: [ {
                provide: HEROES_PROVIDER,
                useValue: [ type, factory ],
                multi: true
            } ]
        };
    }

}

@NgModule({
    imports: [
        HeroFactoryModule.forRoot(HeroTypes.Unknown, HeroBase),

        HeroFactoryModule.forFeature(HeroTypes.Archer, Archer),
        HeroFactoryModule.forFeature(HeroTypes.Warrior, Warrior),
        HeroFactoryModule.forFeature(HeroTypes.Wizard, Wizard)
    ],
    providers: [
        HeroDataService
    ]
})
export class HeroDataModule {
}