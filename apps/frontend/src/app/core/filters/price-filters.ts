import { Service, signal } from '@angular/core';
import type { DataSource, Market, PriceType, StatType } from '@metr-index/shared';
import { DATA_SOURCE_STAT_TYPES } from '@metr-index/shared';

export type DataSourceFilter = DataSource | 'all';
export type StatTypeFilter = StatType | 'all';

function isCompatible(dataSource: DataSourceFilter, statType: StatTypeFilter): boolean {
  if (dataSource === 'all' || statType === 'all') return true;
  return (DATA_SOURCE_STAT_TYPES[dataSource] as StatType[]).includes(statType);
}

@Service()
export class PriceFilters {
  readonly market = signal<Market>('primary');
  readonly priceType = signal<PriceType>('transaction');

  readonly dataSource = signal<DataSourceFilter>('all');
  readonly statType = signal<StatTypeFilter>('all');

  // Setting one of these two can make the other's current value impossible (e.g. picking
  // "NBP" while "Mediana" is selected — NBP never has a median), so each setter resets the
  // other filter back to "all" rather than leaving the panel in a state that silently
  // returns zero rows. isDataSourceDisabled/isStatTypeDisabled below additionally prevent
  // reaching that state in the first place by disabling the incompatible option in the UI.
  setDataSource(value: DataSourceFilter): void {
    this.dataSource.set(value);
    if (!isCompatible(value, this.statType())) {
      this.statType.set('all');
    }
  }

  setStatType(value: StatTypeFilter): void {
    this.statType.set(value);
    if (!isCompatible(this.dataSource(), value)) {
      this.dataSource.set('all');
    }
  }

  isDataSourceDisabled(dataSource: DataSourceFilter): boolean {
    return !isCompatible(dataSource, this.statType());
  }

  isStatTypeDisabled(statType: StatTypeFilter): boolean {
    return !isCompatible(this.dataSource(), statType);
  }
}
