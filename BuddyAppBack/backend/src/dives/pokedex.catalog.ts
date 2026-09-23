export type PokedexCategory = 'Sharks' | 'Tropical fish' | 'Macro' | 'Crustaceans' | 'Rays' | 'Pelagic';

export type PokedexSpecies = {
  key: string;
  name: string;
  category: PokedexCategory;
  imageUrl: string;
};

const commons = (file: string) => `https://commons.wikimedia.org/wiki/Special:FilePath/${file}`;

export const POKEDEX_SPECIES: PokedexSpecies[] = [
  { key: 'great-white-shark', name: 'Great white shark', category: 'Sharks', imageUrl: commons('Great_white_shark.jpg') },
  { key: 'nurse-shark', name: 'Nurse shark', category: 'Sharks', imageUrl: commons('Nurse_shark.jpg') },
  { key: 'thresher-shark', name: 'Thresher shark', category: 'Sharks', imageUrl: commons('Thresher_shark.jpg') },
  { key: 'tiger-shark', name: 'Tiger shark', category: 'Sharks', imageUrl: commons('Tiger_shark.jpg') },
  { key: 'bull-shark', name: 'Bull shark', category: 'Sharks', imageUrl: commons('Bull_shark.jpg') },
  { key: 'basking-shark', name: 'Basking shark', category: 'Sharks', imageUrl: commons('Basking_shark.jpg') },
  { key: 'whale-shark', name: 'Whale shark', category: 'Sharks', imageUrl: commons('Whale_shark.jpg') },
  { key: 'leopard-shark', name: 'Leopard shark', category: 'Sharks', imageUrl: commons('Leopard_shark.jpg') },
  { key: 'clownfish', name: 'Clownfish', category: 'Tropical fish', imageUrl: commons('Clownfish.jpg') },
  { key: 'ocean-sunfish', name: 'Ocean sunfish', category: 'Pelagic', imageUrl: commons('Ocean_sunfish.jpg') },
  { key: 'napoleon-wrasse', name: 'Napoleon wrasse', category: 'Tropical fish', imageUrl: commons('Napoleon_wrasse.jpg') },
  { key: 'grouper', name: 'Grouper', category: 'Tropical fish', imageUrl: commons('Grouper.jpg') },
  { key: 'frogfish', name: 'Frogfish', category: 'Macro', imageUrl: commons('Frogfish.jpg') },
  { key: 'leafy-seadragon', name: 'Leafy seadragon', category: 'Macro', imageUrl: commons('Leafy_seadragon.jpg') },
  { key: 'pipefish', name: 'Pipefish', category: 'Macro', imageUrl: commons('Pipefish.jpg') },
  { key: 'seahorse', name: 'Seahorse', category: 'Macro', imageUrl: commons('Seahorse.jpg') },
  { key: 'nudibranch', name: 'Nudibranch', category: 'Macro', imageUrl: commons('Nudibranch.jpg') },
  { key: 'leaf-scorpionfish', name: 'Leaf scorpionfish', category: 'Macro', imageUrl: commons('Leaf_scorpionfish.jpg') },
  { key: 'cleaner-shrimp', name: 'Cleaner shrimp', category: 'Crustaceans', imageUrl: commons('Cleaner_shrimp.jpg') },
  { key: 'mantis-shrimp', name: 'Mantis shrimp', category: 'Crustaceans', imageUrl: commons('Mantis_shrimp.jpg') },
  { key: 'blue-ringed-octopus', name: 'Blue-ringed octopus', category: 'Macro', imageUrl: commons('Blue-ringed_octopus.jpg') },
  { key: 'manta-ray', name: 'Manta ray', category: 'Rays', imageUrl: commons('Manta_ray.jpg') },
  { key: 'mobula-ray', name: 'Mobula ray', category: 'Rays', imageUrl: commons('Mobula.jpg') },
  { key: 'spotted-eagle-ray', name: 'Spotted eagle ray', category: 'Rays', imageUrl: commons('Spotted_eagle_ray.jpg') },
  { key: 'mediterranean-eagle-ray', name: 'Mediterranean eagle ray', category: 'Rays', imageUrl: commons('Myliobatis_aquila.jpg') },
  { key: 'guitarfish', name: 'Guitarfish', category: 'Rays', imageUrl: commons('Guitarfish.jpg') },
  { key: 'bottlenose-dolphin', name: 'Bottlenose dolphin', category: 'Pelagic', imageUrl: commons('Bottlenose_dolphin.jpg') },
  { key: 'common-stingray', name: 'Common stingray', category: 'Rays', imageUrl: commons('Common_stingray.jpg') },
  { key: 'giant-trevally', name: 'Giant trevally', category: 'Pelagic', imageUrl: commons('Giant_trevally.jpg') },
  { key: 'scorpionfish', name: 'Scorpionfish', category: 'Macro', imageUrl: commons('Scorpaenidae.jpg') },
];

export const getSpecies = (key: string) => POKEDEX_SPECIES.find((species) => species.key === key);
