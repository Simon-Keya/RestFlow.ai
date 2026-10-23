import { BadRequestException } from '@nestjs/common';
import { CostingController } from './costing.controller';
import { CostingService } from './costing.service';

describe('CostingController', () => {
  let controller: CostingController;
  let costingService: {
    getAvgUnitCost: jest.Mock;
    getAvgUnitCosts: jest.Mock;
  };

  beforeEach(() => {
    costingService = {
      getAvgUnitCost: jest.fn(),
      getAvgUnitCosts: jest.fn(),
    };

    controller = new CostingController(
      costingService as unknown as CostingService,
    );
  });

  describe('getSkuCosts', () => {
    it('rejects an empty itemIds value', async () => {
      await expect(controller.getSkuCosts('7', '')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(costingService.getAvgUnitCosts).not.toHaveBeenCalled();
    });

    it('rejects when itemIds contains only whitespace or commas', async () => {
      await expect(
        controller.getSkuCosts('7', ' , , '),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(costingService.getAvgUnitCosts).not.toHaveBeenCalled();
    });

    it('rejects repeated itemIds query parameters parsed as an array', async () => {
      await expect(
        controller.getSkuCosts('7', ['FLOUR', 'SUGAR']),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(costingService.getAvgUnitCosts).not.toHaveBeenCalled();
    });
    it('deduplicates and trims IDs before delegating to the existing service', async () => {
      const response = {
        shopId: '7',
        costs: { FLOUR: 42 },
        sources: { FLOUR: 'inventory_wac' },
      };
      costingService.getAvgUnitCosts.mockResolvedValue(response);

      await expect(
        controller.getSkuCosts('7', ' FLOUR, SUGAR, FLOUR ,, SUGAR '),
      ).resolves.toEqual(response);

      expect(costingService.getAvgUnitCosts).toHaveBeenCalledTimes(1);
      expect(costingService.getAvgUnitCosts).toHaveBeenCalledWith(
        '7',
        ['FLOUR', 'SUGAR'],
      );
    });

    it('rejects more than 100 unique IDs', async () => {
      const ids = Array.from({ length: 101 }, (_, i) => `SKU-${i + 1}`);

      await expect(
        controller.getSkuCosts('7', ids.join(',')),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(costingService.getAvgUnitCosts).not.toHaveBeenCalled();
    });

    it('allows exactly 100 unique IDs', async () => {
      const ids = Array.from({ length: 100 }, (_, i) => `SKU-${i + 1}`);
      costingService.getAvgUnitCosts.mockResolvedValue({
        shopId: '7',
        costs: {},
        sources: {},
      });

      await controller.getSkuCosts('7', ids.join(','));

      expect(costingService.getAvgUnitCosts).toHaveBeenCalledWith('7', ids);
    });
  });

  describe('getSkuCost', () => {
    it('delegates to the original single-SKU costing method', async () => {
      const response = {
        shopId: '7',
        itemId: 'FRIES BOX',
        avgUnitCost: 15,
        availableStock: 20,
        totalValue: 300,
        lastReceiptUnitCost: 15,
        name: 'Fries Box',
        unit: 'piece',
        costSource: 'inventory_wac',
      };
      costingService.getAvgUnitCost.mockResolvedValue(response);

      await expect(
        controller.getSkuCost('FRIES%20BOX', '7'),
      ).resolves.toEqual(response);

      expect(costingService.getAvgUnitCost).toHaveBeenCalledWith(
        '7',
        'FRIES BOX',
      );
    });
  });
});
