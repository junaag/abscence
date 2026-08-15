export const FOOD_RULES = Object.freeze({
  apple: Object.freeze({
    hungerEffect: -9,
    thirstEffect: -4,
    consumptionSeconds: 120,
  }),
});

export const WATER_RULES = Object.freeze({
  servingMl: 250,
  thirstEffectPerServing: -15,
  bottleDrinkSeconds: 20,
  tapDrinkSeconds: 20,
  bottleFillMlPerSecond: 25,
});
