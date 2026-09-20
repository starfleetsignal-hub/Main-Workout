import type { CatalogModel, Category } from './types';

/**
 * Curated master reference list spanning Matchbox's history, 1953-2025.
 *
 * This is a hand-curated reference set of well-known die-cast vehicle types
 * and eras, organized into the "series" groupings collectors commonly use —
 * it is NOT an official Mattel catalog and the "#MB__" numbers are a simple
 * in-app browsing scheme, not real catalog numbers. Add your own real-world
 * entries any time from the "Add" screen; anything you add that isn't in
 * this list is tracked as a custom entry tied to your collection.
 */

type RawModel = [name: string, series: string, year: number, category: Category, colors: string[]];

const RAW_MODELS: RawModel[] = [
  // --- 1-75 Series (Originals), 1953-1969 ---
  ['Model A Ford', '1-75 Series (Originals)', 1953, 'Classic', ['Black', 'Green']],
  ['Karrier Bantam Two-Ton', '1-75 Series (Originals)', 1954, 'SUV & Truck', ['Blue', 'Red']],
  ['Massey Harris Tractor', '1-75 Series (Originals)', 1954, 'Construction', ['Red', 'Orange']],
  ['Bedford Tipper Truck', '1-75 Series (Originals)', 1955, 'Construction', ['Yellow', 'Green']],
  ['London Routemaster Bus', '1-75 Series (Originals)', 1956, 'Bus & Van', ['Red']],
  ['MG TD Roadster', '1-75 Series (Originals)', 1956, 'Classic', ['Cream', 'Red']],
  ['Land Rover Series I', '1-75 Series (Originals)', 1957, 'SUV & Truck', ['Green', 'Sand']],
  ['Volkswagen Beetle', '1-75 Series (Originals)', 1958, 'Classic', ['Blue', 'Grey', 'Red']],
  ['Cadillac Ambulance', '1-75 Series (Originals)', 1958, 'Emergency & Rescue', ['White']],
  ['Jaguar Mk X', '1-75 Series (Originals)', 1959, 'Classic', ['Maroon', 'Black']],
  ['Fire Engine (Pumper)', '1-75 Series (Originals)', 1959, 'Emergency & Rescue', ['Red']],
  ['Aveling Barford Road Roller', '1-75 Series (Originals)', 1960, 'Construction', ['Green']],
  ['Ford Zephyr', '1-75 Series (Originals)', 1960, 'Classic', ['Blue', 'Beige']],
  ['London Taxi (FX4)', '1-75 Series (Originals)', 1961, 'Classic', ['Black']],
  ['Volkswagen Camper', '1-75 Series (Originals)', 1962, 'Bus & Van', ['Turquoise', 'Cream']],
  ['Citroën 2CV', '1-75 Series (Originals)', 1962, 'Classic', ['Yellow', 'Blue']],
  ['Euclid Dump Truck', '1-75 Series (Originals)', 1963, 'Construction', ['Yellow']],
  ['Aston Martin DB5', '1-75 Series (Originals)', 1964, 'Sports Car', ['Silver']],
  ['Ford Mustang (Fastback)', '1-75 Series (Originals)', 1965, 'Muscle Car', ['Red', 'White']],
  ['Mercedes-Benz Unimog', '1-75 Series (Originals)', 1965, 'SUV & Truck', ['Green', 'Orange']],
  ['Fordson Tractor', '1-75 Series (Originals)', 1966, 'Construction', ['Blue']],
  ['Ford GT40', '1-75 Series (Originals)', 1966, 'Racing', ['White', 'Blue']],
  ['Commer Milk Float', '1-75 Series (Originals)', 1967, 'Bus & Van', ['White']],
  ['Volvo P1800', '1-75 Series (Originals)', 1968, 'Classic', ['White', 'Red']],
  ['Iron Fairy Crane', '1-75 Series (Originals)', 1969, 'Construction', ['Red', 'Yellow']],

  // --- Superfast, 1970-1981 ---
  ['Ford Mustang Boss 302', 'Superfast', 1970, 'Muscle Car', ['Orange', 'Yellow']],
  ['1970 Plymouth Superbird', 'Superfast', 1970, 'Muscle Car', ['Blue', 'White', 'Red']],
  ['Chevrolet Camaro Z28', 'Superfast', 1971, 'Muscle Car', ['Yellow', 'Black']],
  ['Dodge Charger R/T', 'Superfast', 1971, 'Muscle Car', ['Orange', 'Green']],
  ['AMC Javelin AMX', 'Superfast', 1971, 'Muscle Car', ['Red', 'White']],
  ['Pontiac Firebird Trans Am', 'Superfast', 1972, 'Muscle Car', ['Blue', 'Black']],
  ['Chevrolet Corvette Stingray', 'Superfast', 1972, 'Sports Car', ['Red', 'Silver']],
  ['Datsun 126X', 'Superfast', 1973, 'Sports Car', ['Orange', 'Yellow']],
  ['Porsche 911 Turbo', 'Superfast', 1973, 'Sports Car', ['White', 'Black']],
  ['Ferrari 308 GTB', 'Superfast', 1974, 'Sports Car', ['Red', 'Yellow']],
  ['Lamborghini Countach LP400', 'Superfast', 1974, 'Sports Car', ['Red', 'White', 'Yellow']],
  ['BMW 3.0 CSL', 'Superfast', 1975, 'Sports Car', ['White', 'Blue']],
  ['Jaguar XJ12', 'Superfast', 1975, 'Classic', ['Silver', 'Green']],
  ['Volkswagen Golf GTI', 'Superfast', 1976, 'Classic', ['Red', 'White']],
  ['Mercedes-Benz 350SL', 'Superfast', 1976, 'Classic', ['Silver', 'Black']],
  ['Chevrolet El Camino', 'Superfast', 1977, 'Muscle Car', ['Yellow', 'Brown']],
  ['Ford Bronco', 'Superfast', 1977, 'SUV & Truck', ['White', 'Blue']],
  ['GMC Pickup', 'Superfast', 1978, 'SUV & Truck', ['Red', 'Black']],
  ['Audi Quattro', 'Superfast', 1978, 'Racing', ['White', 'Red']],
  ['Peterbilt Tanker Truck', 'Superfast', 1979, 'SUV & Truck', ['Red', 'White']],
  ['Freightliner Semi Truck', 'Superfast', 1979, 'SUV & Truck', ['Blue', 'Silver']],
  ['Formula 1 Racer', 'Superfast', 1979, 'Racing', ['Red', 'White']],
  ['Dragster (Rail Fueler)', 'Superfast', 1980, 'Racing', ['Purple', 'Orange']],
  ['Sand Racer Beach Buggy', 'Superfast', 1980, 'Novelty', ['Orange', 'Yellow']],
  ['Snowplow Truck', 'Superfast', 1981, 'Emergency & Rescue', ['Orange']],
  ['Motorcycle - Sport Bike', 'Superfast', 1981, 'Motorcycle', ['Red', 'Black']],
  ['Motorcycle with Sidecar', 'Superfast', 1981, 'Motorcycle', ['Green', 'Black']],
  ['Le Mans Prototype', 'Superfast', 1981, 'Racing', ['White', 'Blue']],

  // --- Superkings (larger scale), 1968-1992 ---
  ['Caterpillar Bulldozer', 'Superkings', 1968, 'Construction', ['Yellow']],
  ['Caterpillar Excavator', 'Superkings', 1970, 'Construction', ['Yellow', 'Black']],
  ['Cement Mixer Truck', 'Superkings', 1972, 'Construction', ['Orange', 'White']],
  ['Dump Truck (Heavy Haul)', 'Superkings', 1973, 'Construction', ['Yellow', 'Green']],
  ['John Deere Tractor', 'Superkings', 1974, 'Construction', ['Green', 'Yellow']],
  ['Case Wheel Loader', 'Superkings', 1975, 'Construction', ['Orange']],
  ['London Double-Decker Bus', 'Superkings', 1976, 'Bus & Van', ['Red']],
  ['School Bus', 'Superkings', 1977, 'Bus & Van', ['Yellow']],
  ['Airport Shuttle Bus', 'Superkings', 1978, 'Bus & Van', ['White', 'Blue']],
  ['Ladder Fire Truck', 'Superkings', 1979, 'Emergency & Rescue', ['Red']],
  ['Tow Truck (Wrecker)', 'Superkings', 1980, 'Emergency & Rescue', ['Red', 'Black']],
  ['Garbage Truck', 'Superkings', 1981, 'SUV & Truck', ['Green', 'White']],
  ['Army Half-Track', 'Superkings', 1982, 'Military', ['Olive Drab']],
  ['Tank Transporter', 'Superkings', 1983, 'Military', ['Olive Drab', 'Sand']],
  ['Circus Truck', 'Superkings', 1985, 'Novelty', ['Red', 'Yellow']],
  ['Car Transporter', 'Superkings', 1987, 'SUV & Truck', ['Blue', 'White']],
  ['Container Truck', 'Superkings', 1989, 'SUV & Truck', ['Orange', 'Blue']],
  ['Refuse Recycling Truck', 'Superkings', 1992, 'SUV & Truck', ['Green']],

  // --- MBX Originals, 1982-1998 ---
  ['Volkswagen Golf', 'MBX Originals', 1982, 'Classic', ['Silver', 'Red']],
  ['Toyota Hilux', 'MBX Originals', 1983, 'SUV & Truck', ['White', 'Red']],
  ['Ford Transit Van', 'MBX Originals', 1984, 'Bus & Van', ['White', 'Blue']],
  ['Delivery Van', 'MBX Originals', 1984, 'Bus & Van', ['Brown', 'Yellow']],
  ['Police Interceptor', 'MBX Originals', 1985, 'Emergency & Rescue', ['Black', 'White']],
  ['Highway Patrol Car', 'MBX Originals', 1985, 'Emergency & Rescue', ['White', 'Black']],
  ['Ambulance (Modular)', 'MBX Originals', 1986, 'Emergency & Rescue', ['White', 'Orange']],
  ['Range Rover', 'MBX Originals', 1986, 'SUV & Truck', ['Green', 'Silver']],
  ['Jeep Wrangler', 'MBX Originals', 1987, 'SUV & Truck', ['Blue', 'Yellow', 'Red']],
  ['BMW M3', 'MBX Originals', 1988, 'Sports Car', ['White', 'Black']],
  ['Dodge Viper GTS', 'MBX Originals', 1989, 'Sports Car', ['Blue', 'Red']],
  ['Mini Cooper S', 'MBX Originals', 1990, 'Classic', ['Red', 'British Racing Green']],
  ['Ford F-150', 'MBX Originals', 1991, 'SUV & Truck', ['Red', 'Black']],
  ['Chevrolet Blazer', 'MBX Originals', 1992, 'SUV & Truck', ['Green', 'White']],
  ['Ice Cream Truck', 'MBX Originals', 1993, 'Novelty', ['White', 'Pink']],
  ['Pizza Delivery Car', 'MBX Originals', 1994, 'Novelty', ['Red']],
  ['Taxi Cab (NYC)', 'MBX Originals', 1994, 'Classic', ['Yellow']],
  ['Monster Truck', 'MBX Originals', 1995, 'Novelty', ['Purple', 'Green']],
  ['Snowmobile', 'MBX Originals', 1996, 'Novelty', ['Red', 'Black']],
  ['ATV Quad Bike', 'MBX Originals', 1997, 'Novelty', ['Green', 'Orange']],
  ['Volkswagen New Beetle', 'MBX Originals', 1998, 'Classic', ['Yellow', 'Blue']],
  ['Coast Guard Rescue Boat & Trailer', 'MBX Originals', 1998, 'Emergency & Rescue', ['Orange', 'White']],

  // --- Premiere Collectibles (reissued classics), 1999-2009 ---
  ['1970 Plymouth Superbird (Premiere)', 'Premiere Collectibles', 1999, 'Muscle Car', ['Blue']],
  ['Ferrari Testarossa', 'Premiere Collectibles', 2000, 'Sports Car', ['Red']],
  ['Jaguar E-Type', 'Premiere Collectibles', 2001, 'Classic', ['British Racing Green']],
  ['Aston Martin DB5 (Premiere)', 'Premiere Collectibles', 2002, 'Classic', ['Silver']],
  ['Chevrolet Corvette Stingray (Premiere)', 'Premiere Collectibles', 2003, 'Sports Car', ['Red', 'White']],
  ['Volkswagen T1 Bus (Premiere)', 'Premiere Collectibles', 2004, 'Bus & Van', ['Turquoise', 'Cream']],
  ['Mercedes-Benz 280SL', 'Premiere Collectibles', 2005, 'Classic', ['White', 'Red']],
  ['Ford Mustang Boss 302 (Premiere)', 'Premiere Collectibles', 2006, 'Muscle Car', ['Orange']],
  ['Dodge Charger R/T (Premiere)', 'Premiere Collectibles', 2007, 'Muscle Car', ['Green']],
  ['Lamborghini Countach LP400 (Premiere)', 'Premiere Collectibles', 2008, 'Sports Car', ['Yellow']],
  ['Volvo 240', 'Premiere Collectibles', 2009, 'Classic', ['Blue', 'Tan']],

  // --- MBX Metro, 2005-2015 ---
  ['MBX Metro Police Cruiser', 'MBX Metro', 2005, 'Emergency & Rescue', ['Black', 'White']],
  ['MBX Metro Fire Pumper', 'MBX Metro', 2006, 'Emergency & Rescue', ['Red']],
  ['MBX Metro Ambulance', 'MBX Metro', 2006, 'Emergency & Rescue', ['White', 'Red']],
  ['MBX Metro Taxi', 'MBX Metro', 2007, 'Classic', ['Yellow']],
  ['MBX Metro Garbage Truck', 'MBX Metro', 2007, 'SUV & Truck', ['Green']],
  ['MBX Metro City Bus', 'MBX Metro', 2008, 'Bus & Van', ['Blue', 'White']],
  ['MBX Metro Delivery Van', 'MBX Metro', 2008, 'Bus & Van', ['Brown']],
  ['MBX Metro Street Sweeper', 'MBX Metro', 2009, 'SUV & Truck', ['Orange']],
  ['MBX Metro Tow Truck', 'MBX Metro', 2009, 'Emergency & Rescue', ['Red']],
  ['MBX Metro Mail Van', 'MBX Metro', 2010, 'Bus & Van', ['White', 'Blue']],
  ['MBX Metro Pickup', 'MBX Metro', 2010, 'SUV & Truck', ['Silver']],
  ['MBX Metro Compact Car', 'MBX Metro', 2011, 'Classic', ['Blue', 'Red']],
  ['MBX Metro Airport Pushback Tug', 'MBX Metro', 2012, 'SUV & Truck', ['Yellow']],
  ['MBX Metro School Bus', 'MBX Metro', 2012, 'Bus & Van', ['Yellow']],
  ['MBX Metro Recycling Truck', 'MBX Metro', 2013, 'SUV & Truck', ['Green', 'Blue']],
  ['MBX Metro Utility Van', 'MBX Metro', 2014, 'Bus & Van', ['White']],
  ['MBX Metro Highway Patrol SUV', 'MBX Metro', 2014, 'Emergency & Rescue', ['Black']],
  ['MBX Metro Food Truck', 'MBX Metro', 2015, 'Novelty', ['Red', 'Yellow']],

  // --- MBX Adventure (modern off-road / SUV / construction / military), 2016-2025 ---
  ['MBX Jeep Wrangler Rubicon', 'MBX Adventure', 2016, 'SUV & Truck', ['Green', 'Orange']],
  ['MBX Toyota Land Cruiser', 'MBX Adventure', 2016, 'SUV & Truck', ['White', 'Tan']],
  ['MBX Ford Bronco (Modern)', 'MBX Adventure', 2017, 'SUV & Truck', ['Blue', 'White']],
  ['MBX Desert Patrol Vehicle', 'MBX Adventure', 2017, 'Military', ['Sand', 'Olive Drab']],
  ['MBX Rock Crawler 4x4', 'MBX Adventure', 2018, 'SUV & Truck', ['Red', 'Black']],
  ['MBX Caterpillar Mini Excavator', 'MBX Adventure', 2018, 'Construction', ['Yellow']],
  ['MBX Wildfire Rescue Truck', 'MBX Adventure', 2019, 'Emergency & Rescue', ['Red', 'Yellow']],
  ['MBX Military Cargo Truck', 'MBX Adventure', 2019, 'Military', ['Olive Drab']],
  ['MBX Snow Groomer', 'MBX Adventure', 2020, 'Construction', ['Orange', 'White']],
  ['MBX Overland Camper Truck', 'MBX Adventure', 2020, 'SUV & Truck', ['Green', 'Tan']],
  ['MBX Volcano Research Rig', 'MBX Adventure', 2021, 'Novelty', ['Yellow', 'Black']],
  ['MBX Amphibious Rescue Vehicle', 'MBX Adventure', 2021, 'Emergency & Rescue', ['Orange']],
  ['MBX Backhoe Loader', 'MBX Adventure', 2022, 'Construction', ['Yellow']],
  ['MBX Arctic Patrol Truck', 'MBX Adventure', 2022, 'Military', ['White', 'Grey']],
  ['MBX Range Rover Sport', 'MBX Adventure', 2023, 'SUV & Truck', ['Black', 'Silver']],
  ['MBX Jungle Expedition Buggy', 'MBX Adventure', 2023, 'Novelty', ['Green', 'Brown']],
  ['MBX Electric Pickup Truck', 'MBX Adventure', 2024, 'SUV & Truck', ['Silver', 'Blue']],
  ['MBX Hybrid Utility SUV', 'MBX Adventure', 2024, 'SUV & Truck', ['White', 'Green']],
  ['MBX Mars Rover Concept', 'MBX Adventure', 2025, 'Novelty', ['White', 'Orange']],
  ['MBX Canyon Crawler', 'MBX Adventure', 2025, 'SUV & Truck', ['Red', 'Grey']],
  ['MBX Volkswagen T1 Bus (Modern)', 'MBX Adventure', 2019, 'Bus & Van', ['Orange', 'White']],
  ['MBX Construction Crane Truck', 'MBX Adventure', 2020, 'Construction', ['Yellow', 'Black']],
  ['MBX Search & Rescue Helicopter Hauler', 'MBX Adventure', 2022, 'Emergency & Rescue', ['Red', 'White']],
  ['MBX Farm Tractor (Modern)', 'MBX Adventure', 2023, 'Construction', ['Green', 'Yellow']],

  // --- MBX Speed & Racing (modern), 2015-2025 ---
  ['MBX Rally Car', 'MBX Speed & Racing', 2015, 'Racing', ['Blue', 'Yellow']],
  ['MBX NASCAR Stock Car', 'MBX Speed & Racing', 2016, 'Racing', ['Red', 'White']],
  ['MBX Drift Car', 'MBX Speed & Racing', 2017, 'Racing', ['Orange', 'Black']],
  ['MBX Le Mans Hypercar', 'MBX Speed & Racing', 2018, 'Racing', ['White', 'Blue']],
  ['MBX Formula Racer (Modern)', 'MBX Speed & Racing', 2019, 'Racing', ['Red']],
  ['MBX Dragster (Modern)', 'MBX Speed & Racing', 2020, 'Racing', ['Purple']],
  ['MBX Cruiser Motorcycle', 'MBX Speed & Racing', 2020, 'Motorcycle', ['Black', 'Chrome']],
  ['MBX Sport Bike (Modern)', 'MBX Speed & Racing', 2021, 'Motorcycle', ['Red', 'Black']],
  ['MBX Enduro Dirt Bike', 'MBX Speed & Racing', 2021, 'Motorcycle', ['Yellow', 'Blue']],
  ['MBX Porsche 911 GT3', 'MBX Speed & Racing', 2022, 'Sports Car', ['White', 'Red']],
  ['MBX Ferrari SF90', 'MBX Speed & Racing', 2022, 'Sports Car', ['Red']],
  ['MBX Lamborghini Huracán', 'MBX Speed & Racing', 2023, 'Sports Car', ['Green', 'Orange']],
  ['MBX Ford Mustang GT (Modern)', 'MBX Speed & Racing', 2023, 'Muscle Car', ['Blue', 'Yellow']],
  ['MBX Dodge Charger Hellcat', 'MBX Speed & Racing', 2024, 'Muscle Car', ['Black', 'Red']],
  ['MBX Chevrolet Camaro SS (Modern)', 'MBX Speed & Racing', 2024, 'Muscle Car', ['Yellow', 'Black']],
  ['MBX Electric Superbike', 'MBX Speed & Racing', 2025, 'Motorcycle', ['Blue', 'Silver']],
  ['MBX Time Attack Coupe', 'MBX Speed & Racing', 2025, 'Racing', ['Green', 'White']],
  ['MBX Vintage Speedway Racer', 'MBX Speed & Racing', 2016, 'Racing', ['Red', 'White']],
];

function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

export const CATALOG: CatalogModel[] = RAW_MODELS.map(([name, series, year, category, colors], i) => ({
  id: `m${i + 1}`,
  number: `MB${pad(i + 1)}`,
  name,
  series,
  year,
  category,
  colors,
}));

export const SERIES_LIST: string[] = Array.from(new Set(CATALOG.map((m) => m.series)));

export const CATALOG_YEAR_RANGE: [number, number] = [
  Math.min(...CATALOG.map((m) => m.year)),
  Math.max(...CATALOG.map((m) => m.year)),
];

export function getModelById(id: string): CatalogModel | undefined {
  return CATALOG.find((m) => m.id === id);
}

export function countBySeries(series: string): number {
  return CATALOG.filter((m) => m.series === series).length;
}
