// Port geocoordinates for all CLA Alaska ports
// Used by the map view

export interface PortGeo {
  code: string;
  name: string;
  lat: number;
  lng: number;
  region: "southeast" | "southcentral" | "western" | "pacific_northwest";
  description?: string;
}

export const PORT_GEO: Record<string, PortGeo> = {
  ANC: { code:"ANC", name:"Anchorage",              lat:61.2181, lng:-149.9003, region:"southcentral", description:"Largest city in Alaska" },
  CDV: { code:"CDV", name:"Cordova",                lat:60.5426, lng:-145.7576, region:"southcentral" },
  CFJ: { code:"CFJ", name:"College Fjord",          lat:61.1000, lng:-147.8000, region:"southcentral", description:"Glacier viewing area in Prince William Sound" },
  DH:  { code:"DH",  name:"Dutch Harbor",           lat:53.8932, lng:-166.5427, region:"western",      description:"Aleutian Islands hub" },
  GB:  { code:"GB",  name:"Glacier Bay",             lat:58.8742, lng:-136.8900, region:"southeast",    description:"UNESCO World Heritage Site" },
  HNS: { code:"HNS", name:"Haines",                 lat:59.2358, lng:-135.4451, region:"southeast" },
  HOM: { code:"HOM", name:"Homer",                  lat:59.6425, lng:-151.5483, region:"southcentral",  description:"The Halibut Fishing Capital of the World" },
  HUB: { code:"HUB", name:"Hubbard Glacier",        lat:60.0167, lng:-139.5000, region:"southeast",    description:"Largest tidewater glacier in North America" },
  ISP: { code:"ISP", name:"Icy Strait Point",       lat:58.1407, lng:-135.4430, region:"southeast" },
  JNU: { code:"JNU", name:"Juneau",                 lat:58.3005, lng:-134.4197, region:"southeast",    description:"Alaska state capital" },
  KAK: { code:"KAK", name:"Kake",                   lat:56.9738, lng:-133.9454, region:"southeast" },
  KDK: { code:"KDK", name:"Kodiak",                 lat:57.7900, lng:-152.4072, region:"southcentral",  description:"Emerald Isle of Alaska" },
  KFJ: { code:"KFJ", name:"Kenai Fjords",           lat:59.9198, lng:-149.6517, region:"southcentral",  description:"National Park with tidewater glaciers" },
  KLW: { code:"KLW", name:"Klawock",                lat:55.5527, lng:-133.1010, region:"southeast" },
  KTN: { code:"KTN", name:"Ketchikan",              lat:55.3422, lng:-131.6461, region:"southeast",    description:"Salmon Capital of the World" },
  MET: { code:"MET", name:"Metlakatla",             lat:55.1291, lng:-131.5779, region:"southeast" },
  MFJ: { code:"MFJ", name:"Misty Fjords",           lat:55.6167, lng:-130.2000, region:"southeast",    description:"National Monument — volcanic fjords" },
  NOM: { code:"NOM", name:"Nome",                   lat:64.5011, lng:-165.4064, region:"western",      description:"Gateway to the Bering Sea" },
  PDH: { code:"PDH", name:"Prudhoe Bay",            lat:70.2553, lng:-148.3374, region:"western",      description:"Northernmost point of Alaska cruise routes" },
  PTB: { code:"PTB", name:"Petersburg",             lat:56.8126, lng:-132.9558, region:"southeast",    description:"Little Norway of Alaska" },
  SEA: { code:"SEA", name:"Seattle",                lat:47.6062, lng:-122.3321, region:"pacific_northwest", description:"Major embarkation port" },
  SEW: { code:"SEW", name:"Seward",                 lat:60.1041, lng:-149.4434, region:"southcentral",  description:"Gateway to Kenai Fjords" },
  SFO: { code:"SFO", name:"San Francisco",          lat:37.7749, lng:-122.4194, region:"pacific_northwest" },
  SIT: { code:"SIT", name:"Sitka",                  lat:57.0531, lng:-135.3300, region:"southeast",    description:"Former Russian capital of Alaska" },
  SKG: { code:"SKG", name:"Skagway",                lat:59.4582, lng:-135.3147, region:"southeast",    description:"Gateway to the Klondike Gold Rush" },
  TA:  { code:"TA",  name:"Tracy Arm",              lat:57.8833, lng:-133.0333, region:"southeast",    description:"Fjord with twin tidewater glaciers" },
  VAN: { code:"VAN", name:"Vancouver",              lat:49.2827, lng:-123.1207, region:"pacific_northwest", description:"Major embarkation port" },
  VDZ: { code:"VDZ", name:"Valdez",                 lat:61.1308, lng:-146.3483, region:"southcentral",  description:"Pipeline terminus" },
  VIC: { code:"VIC", name:"Victoria",               lat:48.4284, lng:-123.3656, region:"pacific_northwest" },
  WHT: { code:"WHT", name:"Whittier",               lat:60.7732, lng:-148.6840, region:"southcentral" },
  WRG: { code:"WRG", name:"Wrangell",               lat:56.4706, lng:-132.3768, region:"southeast" },
};

export const REGION_COLORS: Record<string, string> = {
  southeast:         "#4fc3d8",
  southcentral:      "#c8a84b",
  western:           "#c44040",
  pacific_northwest: "#3a9e6f",
};
