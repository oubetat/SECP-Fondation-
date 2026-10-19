/**
 * SECP Industrial OS - PATCH-325 Marketplace Service
 * Orchestrates engineering component procurement, verification,
 * and integration with CAD/PLM pipelines.
 */
import { MarketplaceEngine, MarketplaceItem, MarketplaceCategory } from './marketplaceEngine';

export class MarketplaceService {
  public getCatalog(): MarketplaceItem[] {
    return MarketplaceEngine.getCatalogItems();
  }
  
  public search(query: string, category: MarketplaceCategory | 'ALL'): MarketplaceItem[] {
    return MarketplaceEngine.filterCatalog(this.getCatalog(), query, category);
  }
}
