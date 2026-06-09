export interface StateZone {
  name: string;
  states: string[];
}

export const NIGERIAN_ZONES: StateZone[] = [
  {
    name: "North Central",
    states: ["Benue", "Kogi", "Kwara", "Nasarawa", "Niger", "Plateau", "FCT Abuja"]
  },
  {
    name: "North East",
    states: ["Adamawa", "Bauchi", "Borno", "Gombe", "Taraba", "Yobe"]
  },
  {
    name: "North West",
    states: ["Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Sokoto", "Zamfara"]
  },
  {
    name: "South East",
    states: ["Abia", "Anambra", "Ebonyi", "Enugu", "Imo"]
  },
  {
    name: "South South",
    states: ["Akwa Ibom", "Bayelsa", "Cross River", "Delta", "Edo", "Rivers"]
  },
  {
    name: "South West",
    states: ["Ekiti", "Lagos", "Ogun", "Ondo", "Osun", "Oyo"]
  }
];

export const NIGERIAN_STATES: string[] = NIGERIAN_ZONES.reduce<string[]>(
  (acc, zone) => [...acc, ...zone.states],
  []
).sort();
