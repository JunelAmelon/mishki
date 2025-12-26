'use server';

import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@mishki/firebase/admin';
import fr from '@/public/locales/fr/common.json';

const ENABLE_SEED = process.env.NEXT_PUBLIC_ENABLE_SEED === 'true';
const SUPPORTED_LOCALES = ['fr', 'en', 'es-PE'] as const;
const frLocale = fr as typeof fr;

type Locale = (typeof SUPPORTED_LOCALES)[number];

type Product = {
  slug: string;
  category: string;
  price: number;
  image: string;
  translations: Record<Locale, { name: string; desc: string; long_desc: string }>;
};

type BlogPost = {
  slug: string;
  image: string;
  date: string;
  readTime: string;
  category: string;
  related: string[];
  author: { name: string; role: string; avatar: string };
  translations: Record<Locale, { title: string; excerpt: string; content: string[] }>;
};

type Ritual = {
  slug: string;
  image: string;
  products: number[];
  translations: Record<
    Locale,
    {
      title: string;
      subtitle: string;
      description: string;
      duration: string;
      difficulty: string;
      full_desc: string;
      steps: { name: string; desc: string }[];
      tips: string[];
    }
  >;
};

type DownloadAssetB2B = {
  slug: string;
  type: 'image' | 'pdf' | 'video';
  category: string;
  format: string;
  size: string;
  url: string;
  translations: Record<
    Locale,
    {
      title: string;
    }
  >;
  defaultLocale?: Locale;
};

type Podcast = {
  slug: string;
  image: string;
  date: string;
  duration: string;
  guest: string;
  translations: Record<
    Locale,
    {
      title: string;
      description: string;
      guest_title: string;
    }
  >;
};

// --- B2B Protocoles ---
type ProtocoleB2B = {
  slug: string;
  type: 'fiche' | 'rituel';
  category: string;
  duration: string;
  image: string;
  translations: Record<
    Locale,
    {
      title: string;
      description: string;
    }
  >;
};

type RituelB2B = {
  slug: string;
  reference: string;
  category: string;
  image: string;
  theme: string;
  ambiance: string;
  duration: string;
  preparation: {
    cabine: string[];
    materiel: string[];
    produits: string[];
  };
  deroulement: {
    phase: string;
    duree: string;
    description: string;
    actions: string[];
  }[];
  retail: string[];
  notes: string[];
  translations: Record<
    Locale,
    {
      title: string;
      introduction: string;
      theme: string;
      ambiance: string;
      category: string;
      duration: string;
      preparation: RituelB2B['preparation'];
      deroulement: RituelB2B['deroulement'];
      retail: string[];
      notes: string[];
    }
  >;
};

type FicheB2B = {
  slug: string;
  reference: string;
  category: string;
  extraction: string;
  volume: string;
  image: string;
  description: string;
  proprietes: string[];
  actifs: { nom: string; role: string }[];
  utilisation: {
    frequence: string;
    methode: string;
    temps: string;
    retrait: string;
  };
  caracteristiques: {
    texture: string;
    odeur: string;
    ph: string;
    conservation: string;
  };
  avis_experts: string;
  translations: Record<
    Locale,
    {
      title: string;
      description: string;
      category: string;
      reference: string;
      extraction: string;
      volume: string;
      proprietes: string[];
      actifs: { nom: string; role: string }[];
      utilisation: FicheB2B['utilisation'];
      caracteristiques: FicheB2B['caracteristiques'];
      avis_experts: string;
    }
  >;
};

function duplicateLocales<T>(frData: T): Record<Locale, T> {
  return SUPPORTED_LOCALES.reduce((acc, locale) => {
    acc[locale] = frData;
    return acc;
  }, {} as Record<Locale, T>);
}

function buildProducts(): Product[] {
  const p = frLocale.b2c.shop.products;
  type ProductKey = keyof typeof p;
  const list: { slug: string; price: number; image: string; category: string; key: ProductKey }[] = [
    { slug: 'p1', key: 'p1', price: 24, image: '/b2c/produit-1.png', category: 'Soins du corps' },
    { slug: 'p2', key: 'p2', price: 12, image: '/b2c/produit-2.png', category: 'Soins du corps' },
    { slug: 'p3', key: 'p3', price: 24, image: '/b2c/produit-3.png', category: 'Soins du visage' },
    { slug: 'p4', key: 'p4', price: 22, image: '/b2c/produit-4.png', category: 'Soins du cheveu' },
    { slug: 'p5', key: 'p5', price: 28, image: '/b2c/produit-1.png', category: 'Soins du visage' },
    { slug: 'p6', key: 'p6', price: 24, image: '/b2c/produit-2.png', category: 'Soins du corps' },
    { slug: 'p7', key: 'p7', price: 16, image: '/b2c/produit-3.png', category: 'Soins du visage' },
    { slug: 'p8', key: 'p8', price: 20, image: '/b2c/produit-4.png', category: 'Soins du visage' },
  ];

  return list.map((item) => {
    const frTrans = p[item.key];
    return {
      slug: item.slug,
      category: item.category,
      price: item.price,
      image: item.image,
      translations: duplicateLocales({
        name: frTrans.name,
        desc: frTrans.desc,
        long_desc: frTrans.long_desc ?? frTrans.desc,
      }),
    };
  });
}

function buildProtocolesB2B(): { rituels: RituelB2B[]; fiches: FicheB2B[] } {
  const rituels: RituelB2B[] = [
    {
      slug: 'rituel-hydratation',
      reference: 'RC-HYD-002',
      category: 'Visage',
      image: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=800&h=400&fit=crop',
      theme: 'Hydratation & Éclat',
      ambiance: 'Zen & Cocooning',
      duration: '45 min',
      preparation: {
        cabine: ['Température : 22-24°C', 'Lumière tamisée ou bougies LED', "Diffusion d'huiles essentielles d'agrumes", 'Musique douce type spa'],
        materiel: ['Serviettes chaudes', 'Compresses tièdes', 'Bols pour préparations', 'Spatule et pinceau'],
        produits: [
          'Lait démaquillant',
          'Lotion tonique',
          'Gommage doux enzymatique',
          'Sérum hydratant',
          'Masque hydratation intense',
          'Crème confort',
        ],
      },
      deroulement: [
        {
          phase: 'Accueil & Installation',
          duree: '5 min',
          description: "Création de l'ambiance et mise en confiance",
          actions: [
            'Accueillir la cliente avec une tisane relaxante',
            'Expliquer le déroulement du rituel',
            'Installer confortablement sur la table de soin',
            'Placer des protections et bande à cheveux',
          ],
        },
        {
          phase: "Rituel d'Ouverture",
          duree: '3 min',
          description: 'Connexion et respiration',
          actions: [
            'Placer les mains sur les épaules',
            'Inviter à 3 respirations profondes',
            'Effectuer des pressions douces sur les épaules',
            'Créer une intention de détente',
          ],
        },
        {
          phase: 'Nettoyage Sensoriel',
          duree: '7 min',
          description: 'Démaquillage et purification',
          actions: [
            'Appliquer le lait démaquillant en mouvements enveloppants',
            'Retirer avec des compresses tièdes parfumées',
            'Vaporiser la lotion tonique en fine brume',
            'Sécher en tamponnant délicatement',
          ],
        },
        {
          phase: 'Exfoliation Lumière',
          duree: '8 min',
          description: "Gommage pour révéler l'éclat",
          actions: [
            'Appliquer le gommage enzymatique au pinceau',
            'Masser en mouvements circulaires doux',
            'Laisser poser 3-4 minutes',
            'Retirer avec des compresses humides',
          ],
        },
        {
          phase: 'Massage Hydratant',
          duree: '12 min',
          description: 'Massage profond du visage et décolleté',
          actions: [
            'Appliquer le sérum hydratant généreux',
            'Effectuer le massage drainant du décolleté',
            'Réaliser les manœuvres lissantes du visage',
            'Terminer par des pressions calmantes',
          ],
        },
        {
          phase: 'Pause Cocooning',
          duree: '10 min',
          description: 'Application du masque et relaxation',
          actions: [
            'Appliquer le masque hydratation en couche généreuse',
            'Placer des compresses fraîches sur les yeux',
            'Effectuer un massage des mains et bras',
            'Laisser la cliente se reposer',
          ],
        },
        {
          phase: 'Rituel de Fermeture',
          duree: '5 min',
          description: 'Retour en douceur et finalisation',
          actions: [
            'Retirer le masque délicatement',
            "Vaporiser une brume d'eau florale",
            'Appliquer la crème confort en effleurages',
            'Effectuer des pressions sur les points énergétiques',
          ],
        },
      ],
      retail: ['Crème hydratante format maison', 'Sérum hydratant voyage', 'Masque hydratation à faire chez soi'],
      notes: [
        'Adapter les textures selon le type de peau',
        'Maintenir un contact permanent avec la cliente',
        'Créer une ambiance olfactive personnalisée',
        'Proposer une tisane détox en fin de soin',
      ],
      translations: duplicateLocales({
        title: 'Rituel Hydratation Divine',
        introduction: "Un rituel dédié à l'hydratation profonde de la peau pour retrouver éclat et souplesse. Une expérience sensorielle complète.",
        theme: 'Hydratation & Éclat',
        ambiance: 'Zen & Cocooning',
        category: 'Visage',
        duration: '45 min',
        preparation: {
          cabine: ['Température : 22-24°C', 'Lumière tamisée ou bougies LED', "Diffusion d'huiles essentielles d'agrumes", 'Musique douce type spa'],
          materiel: ['Serviettes chaudes', 'Compresses tièdes', 'Bols pour préparations', 'Spatule et pinceau'],
          produits: [
            'Lait démaquillant',
            'Lotion tonique',
            'Gommage doux enzymatique',
            'Sérum hydratant',
            'Masque hydratation intense',
            'Crème confort',
          ],
        },
        deroulement: [
          {
            phase: 'Accueil & Installation',
            duree: '5 min',
            description: "Création de l'ambiance et mise en confiance",
            actions: [
              'Accueillir la cliente avec une tisane relaxante',
              'Expliquer le déroulement du rituel',
              'Installer confortablement sur la table de soin',
              'Placer des protections et bande à cheveux',
            ],
          },
          {
            phase: "Rituel d'Ouverture",
            duree: '3 min',
            description: 'Connexion et respiration',
            actions: [
              'Placer les mains sur les épaules',
              'Inviter à 3 respirations profondes',
              'Effectuer des pressions douces sur les épaules',
              'Créer une intention de détente',
            ],
          },
          {
            phase: 'Nettoyage Sensoriel',
            duree: '7 min',
            description: 'Démaquillage et purification',
            actions: [
              'Appliquer le lait démaquillant en mouvements enveloppants',
              'Retirer avec des compresses tièdes parfumées',
              'Vaporiser la lotion tonique en fine brume',
              'Sécher en tamponnant délicatement',
            ],
          },
          {
            phase: 'Exfoliation Lumière',
            duree: '8 min',
            description: "Gommage pour révéler l'éclat",
            actions: [
              'Appliquer le gommage enzymatique au pinceau',
              'Masser en mouvements circulaires doux',
              'Laisser poser 3-4 minutes',
              'Retirer avec des compresses humides',
            ],
          },
          {
            phase: 'Massage Hydratant',
            duree: '12 min',
            description: 'Massage profond du visage et décolleté',
            actions: [
              'Appliquer le sérum hydratant généreux',
              'Effectuer le massage drainant du décolleté',
              'Réaliser les manœuvres lissantes du visage',
              'Terminer par des pressions calmantes',
            ],
          },
          {
            phase: 'Pause Cocooning',
            duree: '10 min',
            description: 'Application du masque et relaxation',
            actions: [
              'Appliquer le masque hydratation en couche généreuse',
              'Placer des compresses fraîches sur les yeux',
              'Effectuer un massage des mains et bras',
              'Laisser la cliente se reposer',
            ],
          },
          {
            phase: 'Rituel de Fermeture',
            duree: '5 min',
            description: 'Retour en douceur et finalisation',
            actions: [
              'Retirer le masque délicatement',
              "Vaporiser une brume d'eau florale",
              'Appliquer la crème confort en effleurages',
              'Effectuer des pressions sur les points énergétiques',
            ],
          },
        ],
        retail: ['Crème hydratante format maison', 'Sérum hydratant voyage', 'Masque hydratation à faire chez soi'],
        notes: [
          'Adapter les textures selon le type de peau',
          'Maintenir un contact permanent avec la cliente',
          'Créer une ambiance olfactive personnalisée',
          'Proposer une tisane détox en fin de soin',
        ],
      }),
    },
  ];

  const fiches: FicheB2B[] = [
    {
      slug: 'masque-hydratation-intense',
      reference: 'FT-HYD-001',
      category: 'Soins Visage',
      extraction: 'Extrait de Rose des Sables',
      volume: '250ml (Format Pro)',
      image: 'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?w=800&h=400&fit=crop',
      description:
        'Un masque professionnel hautement concentré en actifs hydratants et régénérants. Conçu pour restaurer la barrière cutanée et apporter un confort immédiat aux peaux déshydratées.',
      proprietes: ['Hydratation longue durée (8h)', 'Restauration du film hydrolipidique', 'Apaisement immédiat', "Éclat du teint instantané"],
      actifs: [
        { nom: 'Acide Hyaluronique HPM', role: 'Hydratation de surface et lissage' },
        { nom: 'Extrait de Rose des Sables', role: "Auto-protection cellulaire et rétention d'eau" },
        { nom: 'Beurre de Karité Bio', role: 'Nutrition et protection de la barrière cutanée' },
        { nom: 'Vitamine E', role: 'Antioxydant et protection contre les radicaux libres' },
      ],
      utilisation: {
        frequence: '1 à 2 fois par semaine selon le diagnostic',
        methode: 'Appliquer en couche moyenne sur le visage et le cou parfaitement nettoyés. Éviter le contour des yeux.',
        temps: '10 à 15 minutes',
        retrait: "Retirer l'excédent avec un coton humide ou rincer à l'eau tiède.",
      },
      caracteristiques: {
        texture: 'Crème onctueuse et fraîche',
        odeur: 'Notes florales délicates',
        ph: '5.5 - 6.0',
        conservation: '12 mois après ouverture',
      },
      avis_experts:
        'Indispensable pour les rituels post-exposition solaire ou en cure d’attaque hivernale. Sa texture permet une pénétration optimale des actifs.',
      translations: duplicateLocales({
        title: 'Masque Hydratation Intense',
        description:
          'Un masque professionnel hautement concentré en actifs hydratants et régénérants. Conçu pour restaurer la barrière cutanée et apporter un confort immédiat aux peaux déshydratées.',
        category: 'Soins Visage',
        reference: 'FT-HYD-001',
        extraction: 'Extrait de Rose des Sables',
        volume: '250ml (Format Pro)',
        proprietes: ['Hydratation longue durée (8h)', 'Restauration du film hydrolipidique', 'Apaisement immédiat', "Éclat du teint instantané"],
        actifs: [
          { nom: 'Acide Hyaluronique HPM', role: 'Hydratation de surface et lissage' },
          { nom: 'Extrait de Rose des Sables', role: "Auto-protection cellulaire et rétention d'eau" },
          { nom: 'Beurre de Karité Bio', role: 'Nutrition et protection de la barrière cutanée' },
          { nom: 'Vitamine E', role: 'Antioxydant et protection contre les radicaux libres' },
        ],
        utilisation: {
          frequence: '1 à 2 fois par semaine selon le diagnostic',
          methode: 'Appliquer en couche moyenne sur le visage et le cou parfaitement nettoyés. Éviter le contour des yeux.',
          temps: '10 à 15 minutes',
          retrait: "Retirer l'excédent avec un coton humide ou rincer à l'eau tiède.",
        },
        caracteristiques: {
          texture: 'Crème onctueuse et fraîche',
          odeur: 'Notes florales délicates',
          ph: '5.5 - 6.0',
          conservation: '12 mois après ouverture',
        },
        avis_experts:
          'Indispensable pour les rituels post-exposition solaire ou en cure d’attaque hivernale. Sa texture permet une pénétration optimale des actifs.',
      }),
    },
  ];

  return { rituels, fiches };
}

function buildDownloadsB2B(): DownloadAssetB2B[] {
  const assets = [
    {
      slug: 'affiche-printemps-2025',
      type: 'image',
      category: 'PLV',
      format: 'JPG',
      size: '2.4 MB',
      url: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=1200',
      title: 'Affiche Promotionnelle Printemps 2025',
    },
    {
      slug: 'catalogue-2025',
      type: 'pdf',
      category: 'Catalogues',
      format: 'PDF',
      size: '15.2 MB',
      url: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=1200',
      title: 'Catalogue Produits 2025',
    },
    {
      slug: 'video-tutoriel-massage-visage',
      type: 'video',
      category: 'Formations',
      format: 'MP4',
      size: '45.8 MB',
      url: 'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?w=1200',
      title: 'Vidéo Tutoriel Massage Visage',
    },
    {
      slug: 'banniere-web-anti-age',
      type: 'image',
      category: 'Digital',
      format: 'PNG',
      size: '1.2 MB',
      url: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=1200',
      title: 'Bannière Web Anti-âge',
    },
    {
      slug: 'presentoir-comptoir',
      type: 'image',
      category: 'PLV',
      format: 'JPG',
      size: '3.1 MB',
      url: 'https://images.unsplash.com/photo-1596704017254-9b121068ec31?w=1200',
      title: 'Présentoir Comptoir',
    },
    {
      slug: 'guide-utilisation-produits',
      type: 'pdf',
      category: 'Documentation',
      format: 'PDF',
      size: '8.5 MB',
      url: 'https://images.unsplash.com/photo-1554224311-beee4ece8db7?w=1200',
      title: "Guide d'utilisation Produits",
    },
    {
      slug: 'post-instagram-nouveaute',
      type: 'image',
      category: 'Social Media',
      format: 'JPG',
      size: '0.8 MB',
      url: 'https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=1200',
      title: 'Post Instagram - Nouveauté',
    },
    {
      slug: 'flyer-promo-ete',
      type: 'pdf',
      category: 'PLV',
      format: 'PDF',
      size: '4.2 MB',
      url: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=1200',
      title: 'Flyer Promotion Été',
    },
  ];

  return assets.map((a) => ({
    slug: a.slug,
    type: a.type as DownloadAssetB2B['type'],
    category: a.category,
    format: a.format,
    size: a.size,
    url: a.url,
    defaultLocale: 'fr',
    translations: duplicateLocales({
      title: a.title,
    }),
  }));
}

function buildBlogPosts(): BlogPost[] {
  const posts = [
    {
      slug: 'p1',
      image: 'https://images.pexels.com/photos/3762879/pexels-photo-3762879.jpeg?auto=compress&cs=tinysrgb&w=1600',
      date: '10 Dec 2024',
      readTime: '5 min',
      category: 'Soins naturels',
      author: { name: 'Sophie Martin', role: 'Experte en cosmetique naturelle', avatar: 'SM' },
      related: ['p2', 'p3'],
      title: "Les bienfaits de l'huile de jojoba pour votre peau",
      excerpt: "Decouvrez comment l'huile de jojoba peut transformer votre routine de soins et apporter eclat et hydratation a votre peau.",
      content: [
        "L'huile de jojoba est l'un des ingredients les plus precieux dans le monde de la cosmetique naturelle. Extraite des graines du jojoba, un arbuste originaire des deserts d'Amerique du Nord, cette huile possede des proprietes exceptionnelles qui en font un allie incontournable pour la beaute de la peau.",
        "Contrairement a la plupart des huiles vegetales, l'huile de jojoba est en realite une cire liquide dont la composition se rapproche etonnamment du sebum humain. Cette caracteristique unique lui permet d'etre parfaitement assimilee par la peau, sans laisser de film gras ni obstruer les pores.",
        "Les bienfaits de l'huile de jojoba sont nombreux. Elle hydrate en profondeur tout en regulant la production de sebum, ce qui la rend adaptee a tous les types de peau, y compris les peaux grasses et a tendance acneique. Ses proprietes anti-inflammatoires apaisent les irritations et les rougeurs.",
        "Riche en vitamines E et B, ainsi qu'en mineraux essentiels, l'huile de jojoba nourrit la peau et l'aide a lutter contre les signes du vieillissement. Elle forme egalement une barriere protectrice qui preserve l'hydratation naturelle de la peau.",
        "Pour integrer l'huile de jojoba dans votre routine, vous pouvez l'appliquer pure sur le visage et le corps, ou l'utiliser comme ingredient dans vos preparations maison. Quelques gouttes suffisent pour profiter de tous ses bienfaits.",
        "Chez Mishki, nous avons fait de l'huile de jojoba l'un des piliers de nos formulations. Associee aux ingredients traditionnels peruviens, elle participe a l'efficacite de nos soins tout en respectant votre peau et l'environnement.",
      ],
    },
    {
      slug: 'p2',
      image: 'https://images.pexels.com/photos/3997379/pexels-photo-3997379.jpeg?auto=compress&cs=tinysrgb&w=1600',
      date: '5 Dec 2024',
      readTime: '7 min',
      category: 'Heritage',
      author: { name: 'Maria Santos', role: 'Ethnobotaniste', avatar: 'MS' },
      related: ['p1', 'p5'],
      title: 'Rituels de beaute peruviens ancestraux',
      excerpt: 'Plongez dans les traditions de beaute du Perou et decouvrez des secrets transmis de generation en generation.',
      content: [
        'Le Perou, terre de contrastes et de biodiversite exceptionnelle, abrite depuis des millenaires des traditions de beaute uniques. Les femmes peruviennes ont toujours su tirer parti des ressources naturelles extraordinaires de leur environnement pour prendre soin de leur peau et de leurs cheveux.',
        "Parmi les ingredients emblematiques de la cosmetique peruvienne, on trouve le quinoa, la maca, l'aguaje et le camu-camu. Chacun de ces tresors de la nature possede des proprietes specifiques qui contribuent a la beaute et a la sante de la peau.",
        "Le quinoa, par exemple, est utilise depuis l'epoque incaique pour ses vertus nourrissantes et reparatrices. Riche en proteines et en acides amines, il renforce la structure de la peau et lui redonne eclat et vitalite.",
        "L'aguaje, fruit du palmier moriche, est surnomme le \"fruit de la beaute\" par les populations amazoniennes. Sa teneur exceptionnelle en vitamine A en fait un puissant antioxydant qui protege la peau des agressions exterieures.",
        "Ces rituels ancestraux ne se limitent pas aux ingredients utilises. Ils incluent egalement des gestes et des moments particuliers dedies au bien-etre. Les femmes peruviennes accordent une grande importance au massage et a la meditation, considerant que la beaute vient aussi de l'interieur.",
        'Chez Mishki, nous nous inspirons de cette sagesse ancestrale pour creer des soins qui respectent a la fois les traditions et les besoins des peaux modernes. Chaque produit est une invitation a decouvrir les secrets de beaute du Perou.',
      ],
    },
    {
      slug: 'p3',
      image: 'https://images.pexels.com/photos/3785147/pexels-photo-3785147.jpeg?auto=compress&cs=tinysrgb&w=1600',
      date: '28 Nov 2024',
      readTime: '6 min',
      category: 'Conseils',
      author: { name: 'Claire Dubois', role: 'Dermatologue', avatar: 'CD' },
      related: ['p1', 'p4'],
      title: 'Comment choisir le bon soin pour votre type de peau',
      excerpt: 'Guide complet pour identifier votre type de peau et selectionner les produits les plus adaptes a vos besoins.',
      content: [
        "Choisir les bons soins pour sa peau peut sembler complique face a la multitude de produits disponibles. Pourtant, tout commence par une etape essentielle: identifier votre type de peau. Cette connaissance vous permettra de selectionner les produits les plus adaptes a vos besoins specifiques.",
        'Il existe quatre types de peau principaux: normale, seche, grasse et mixte. La peau normale est equilibree, ni trop grasse ni trop seche. La peau seche manque de sebum et a tendance a tiraillement. La peau grasse produit un exces de sebum et presente souvent des brillances. La peau mixte combine zones grasses et zones seches.',
        "Pour identifier votre type de peau, nettoyez votre visage et attendez une heure sans appliquer de soin. Observez ensuite votre peau: si elle brille sur l'ensemble du visage, elle est grasse. Si elle tire et presente des zones de secheresse, elle est seche. Si seule la zone T brille, elle est mixte.",
        'Une fois votre type de peau identifie, vous pouvez selectionner vos soins. Les peaux seches privilegieront les textures riches et nourrissantes. Les peaux grasses opteront pour des formules legeres et matifiantes. Les peaux mixtes pourront adapter leurs soins selon les zones du visage.',
        "N'oubliez pas que votre peau evolue au fil du temps et des saisons. Il est important de rester a l'ecoute de ses besoins et d'adapter votre routine en consequence. Un bilan regulier vous aidera a maintenir une peau en pleine sante.",
        "Chez Mishki, nos experts sont a votre disposition pour vous guider dans le choix de vos soins. N'hesitez pas a nous contacter pour beneficier de conseils personnalises adaptes a votre type de peau.",
      ],
    },
    {
      slug: 'p4',
      image: 'https://images.pexels.com/photos/3756165/pexels-photo-3756165.jpeg?auto=compress&cs=tinysrgb&w=1600',
      date: '20 Nov 2024',
      readTime: '4 min',
      category: 'Bien-etre',
      author: { name: 'Sophie Martin', role: 'Experte en cosmetique naturelle', avatar: 'SM' },
      related: ['p3', 'p6'],
      title: "L'importance de l'hydratation quotidienne",
      excerpt: 'Pourquoi hydrater sa peau chaque jour est essentiel et comment integrer cette habitude dans votre routine.',
      content: [
        "L'hydratation est la cle d'une peau saine et eclatante. Que votre peau soit seche, grasse ou mixte, elle a besoin d'eau pour fonctionner correctement et conserver sa beaute. Pourtant, l'hydratation reste souvent negligee dans les routines de soins.",
        'La peau est composee a 70% deau. Cette eau est essentielle pour maintenir lelasticite de la peau, assurer le renouvellement cellulaire et proteger contre les agressions exterieures. Une peau deshydratee perd de sa souplesse, parait terne et vieillit prematurement.',
        "L'hydratation de la peau se fait de deux manieres complementaires: de l'interieur, en buvant suffisamment d'eau, et de l'exterieur, en appliquant des soins hydratants. Les deux approches sont indispensables pour une hydratation optimale.",
        'Pour hydrater efficacement votre peau, commencez par boire au moins 1,5 litre deau par jour. Completez cette hydratation interne par lapplication quotidienne dun soin adapte a votre type de peau. Le matin, optez pour une creme legere. Le soir, privilegiez une formule plus riche.',
        "Les ingredients hydratants les plus efficaces sont l'acide hyaluronique, qui peut retenir jusqu'a 1000 fois son poids en eau, la glycerine, le beurre de karite et les huiles vegetales comme l'huile de jojoba ou d'argan.",
        'Chez Mishki, nous formulons des soins hydratants a base dingredients naturels qui apportent a la peau leau dont elle a besoin tout au long de la journee. Nos formules combinent tradition peruvienne et efficacite moderne pour une hydratation optimale.',
      ],
    },
    {
      slug: 'p5',
      image: 'https://images.pexels.com/photos/3737579/pexels-photo-3737579.jpeg?auto=compress&cs=tinysrgb&w=1600',
      date: '15 Nov 2024',
      readTime: '8 min',
      category: 'Ingredients',
      author: { name: 'Maria Santos', role: 'Ethnobotaniste', avatar: 'MS' },
      related: ['p1', 'p2'],
      title: 'Les ingredients stars de la cosmetique naturelle',
      excerpt: 'Focus sur les ingredients naturels les plus efficaces et leurs proprietes exceptionnelles pour votre peau.',
      content: [
        'La cosmetique naturelle connait un essor sans precedent, et pour cause: les ingredients issus de la nature offrent des bienfaits exceptionnels pour la peau, sans les effets indesirables des molecules de synthese. Decouvrez les stars de la beaute naturelle.',
        "L'aloe vera est sans doute l'ingredient naturel le plus connu. Cette plante grasse contient plus de 200 composants actifs qui hydratent, apaisent et reparent la peau. Elle est particulierement recommandee pour les peaux sensibles et irritees.",
        'Le beurre de karite, issu du karite dAfrique, est un tresor de nutrition pour la peau. Riche en vitamines A, E et F, il nourrit intensement, protege et regenere les peaux les plus seches. Il est egalement excellent pour les cheveux.',
        "L'huile d'argan, appelee \"or liquide du Maroc\", est reconnue pour ses proprietes anti-age exceptionnelles. Sa richesse en antioxydants et en acides gras essentiels en fait un soin precieux pour lutter contre le vieillissement cutane.",
        'Le the vert est un puissant antioxydant qui protege la peau des radicaux libres responsables du vieillissement premature. Il possede egalement des proprietes anti-inflammatoires et antibacteriennes.',
        'Chez Mishki, nous associons ces ingredients universels aux tresors de la biodiversite peruvienne pour creer des formules uniques et efficaces. Chaque produit est le fruit dune selection rigoureuse des meilleurs ingredients naturels.',
      ],
    },
    {
      slug: 'p6',
      image: 'https://images.pexels.com/photos/3762874/pexels-photo-3762874.jpeg?auto=compress&cs=tinysrgb&w=1600',
      date: '10 Nov 2024',
      readTime: '5 min',
      category: 'Routines',
      author: { name: 'Claire Dubois', role: 'Dermatologue', avatar: 'CD' },
      related: ['p4', 'p3'],
      title: 'Routine du soir: les etapes essentielles',
      excerpt: 'Decouvrez la routine du soir ideale pour preparer votre peau au renouvellement cellulaire nocturne.',
      content: [
        "La routine du soir est un moment crucial pour la beaute de votre peau. Pendant la nuit, votre peau se regenere et se repare. En adoptant les bons gestes avant le coucher, vous optimisez ce processus naturel et vous vous reveillez avec une peau reposee et eclatante.",
        "La premiere etape, et la plus importante, est le demaquillage. Meme si vous ne vous etes pas maquillee, cette etape permet d'eliminer les impuretes et les polluants accumules tout au long de la journee. Utilisez une huile ou un lait demaquillant doux.",
        'Apres le demaquillage, procedez au nettoyage. Cette double cleansing, comme lappellent les experts, assure une peau parfaitement propre. Choisissez un nettoyant adapte a votre type de peau: gel moussant pour les peaux grasses, lait ou creme pour les peaux seches.',
        "L'etape suivante est l'application d'un tonique ou d'une lotion. Ce soin permet de retablir le pH de la peau et de la preparer a recevoir les soins suivants. Appliquez-le avec un coton ou directement avec les mains.",
        'Terminez votre routine par lapplication dun serum et dune creme de nuit. Le serum, concentre en actifs, cible des problematiques specifiques. La creme de nuit, plus riche que celle du jour, nourrit et repare la peau pendant votre sommeil.',
        "Chez Mishki, nous avons concu une gamme complete pour votre rituel du soir. Nos soins travaillent en synergie pour offrir a votre peau tout ce dont elle a besoin pour se regenerer pendant la nuit.",
      ],
    },
  ];

  return posts.map((p) => ({
    slug: p.slug,
    image: p.image,
    date: p.date,
    readTime: p.readTime,
    category: p.category,
    related: p.related,
    author: p.author,
    translations: duplicateLocales({
      title: p.title,
      excerpt: p.excerpt,
      content: p.content,
    }),
  }));
}

function buildRituals(): Ritual[] {
  const r = frLocale.b2c.rituals.items;
  type RitualKey = keyof typeof r;
  const list: { slug: string; key: RitualKey; image: string; products: number[] }[] = [
    { slug: 'morning', key: 'morning', image: 'https://images.pexels.com/photos/3762879/pexels-photo-3762879.jpeg?auto=compress&cs=tinysrgb&w=800', products: [1, 3] },
    { slug: 'evening', key: 'evening', image: 'https://images.pexels.com/photos/3997379/pexels-photo-3997379.jpeg?auto=compress&cs=tinysrgb&w=800', products: [2, 3] },
    { slug: 'weekly', key: 'weekly', image: 'https://images.pexels.com/photos/3785147/pexels-photo-3785147.jpeg?auto=compress&cs=tinysrgb&w=800', products: [1, 2, 4] },
    { slug: 'detox', key: 'detox', image: 'https://images.pexels.com/photos/3756165/pexels-photo-3756165.jpeg?auto=compress&cs=tinysrgb&w=800', products: [1, 4] },
  ];

  return list.map((item) => {
    const data = r[item.key];
    return {
      slug: item.slug,
      image: item.image,
      products: item.products,
      translations: duplicateLocales({
        title: data.title,
        subtitle: data.subtitle,
        description: data.desc,
        duration: data.duration,
        difficulty: data.difficulty,
        full_desc: data.full_desc ?? data.desc,
        steps: (data.steps || []).map((s) => ({ name: s.name, desc: s.desc })),
        tips: data.tips || [],
      }),
    };
  });
}

function buildPodcasts(): Podcast[] {
  const p = frLocale.b2c.podcast;
  type PodcastKey = keyof typeof p.episodes;
  const episodes: { slug: string; key: PodcastKey; duration: string; date: string; image: string; guest: string }[] = [
    {
      slug: 'e1',
      key: 'e1',
      duration: '45 min',
      date: '10 Dec 2024',
      image: 'https://images.pexels.com/photos/3762879/pexels-photo-3762879.jpeg?auto=compress&cs=tinysrgb&w=800',
      guest: 'Dr. Maria Santos',
    },
    {
      slug: 'e2',
      key: 'e2',
      duration: '38 min',
      date: '3 Dec 2024',
      image: 'https://images.pexels.com/photos/3997379/pexels-photo-3997379.jpeg?auto=compress&cs=tinysrgb&w=800',
      guest: 'Sophie Durand',
    },
    {
      slug: 'e3',
      key: 'e3',
      duration: '52 min',
      date: '26 Nov 2024',
      image: 'https://images.pexels.com/photos/3785147/pexels-photo-3785147.jpeg?auto=compress&cs=tinysrgb&w=800',
      guest: 'Jean-Pierre Martin',
    },
    {
      slug: 'e4',
      key: 'e4',
      duration: '48 min',
      date: '19 Nov 2024',
      image: 'https://images.pexels.com/photos/3756165/pexels-photo-3756165.jpeg?auto=compress&cs=tinysrgb&w=800',
      guest: 'Amelia Chen',
    },
    {
      slug: 'e5',
      key: 'e5',
      duration: '42 min',
      date: '12 Nov 2024',
      image: 'https://images.pexels.com/photos/3737579/pexels-photo-3737579.jpeg?auto=compress&cs=tinysrgb&w=800',
      guest: 'Dr. Claire Dubois',
    },
    {
      slug: 'e6',
      key: 'e6',
      duration: '35 min',
      date: '5 Nov 2024',
      image: 'https://images.pexels.com/photos/3762874/pexels-photo-3762874.jpeg?auto=compress&cs=tinysrgb&w=800',
      guest: 'Yuki Tanaka',
    },
  ];

  return episodes.map((ep) => {
    const data = p.episodes[ep.key];
    return {
      slug: ep.slug,
      image: ep.image,
      date: ep.date,
      duration: ep.duration,
      guest: ep.guest,
      translations: duplicateLocales({
        title: data.title,
        description: data.description,
        guest_title: data.guest_title,
      }),
    };
  });
}

async function createTestUsers() {
  if (!adminAuth) {
    throw new Error('Admin Auth not configured');
  }

  const users = [
    {
      email: 'client@mishki.com',
      password: 'ClientMishki2025!',
      role: 'b2c',
      displayName: 'Client Test B2C',
    },
    {
      email: 'pro@mishki.com',
      password: 'ProMishki2025!',
      role: 'b2b',
      displayName: 'Professionnel Test B2B',
    },
  ];

  const createdUsers = [];

  for (const userData of users) {
    try {
      // Vérifier si l'utilisateur existe déjà
      let userRecord;
      try {
        userRecord = await adminAuth.getUserByEmail(userData.email);
        console.log(`User ${userData.email} already exists, skipping creation`);
      } catch (error: any) {
        if (error.code === 'auth/user-not-found') {
          // Créer l'utilisateur dans Firebase Auth
          userRecord = await adminAuth.createUser({
            email: userData.email,
            password: userData.password,
            displayName: userData.displayName,
            emailVerified: true,
          });
          console.log(`Created user: ${userData.email} with UID: ${userRecord.uid}`);
        } else {
          throw error;
        }
      }

      // Créer/mettre à jour le document dans Firestore
      if (userRecord) {
        const userDoc: any = {
          email: userData.email,
          role: userData.role,
          displayName: userData.displayName,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        // Ajouter des champs spécifiques pour le B2B
        if (userData.role === 'b2b') {
          userDoc.validated = true; // Compte validé automatiquement pour les tests
          userDoc.remise = 15; // Remise pro de 15%
          userDoc.societe = 'Société Test B2B';
          userDoc.siret = '12345678901234';
          userDoc.nom = 'Test';
          userDoc.prenom = 'Pro';
        }

        await adminDb?.collection('users').doc(userRecord.uid).set(userDoc, { merge: true });
        console.log(`Created/updated Firestore document for ${userData.email}`);

        createdUsers.push({
          uid: userRecord.uid,
          email: userData.email,
          role: userData.role,
        });
      }
    } catch (error: any) {
      console.error(`Error creating user ${userData.email}:`, error.message);
      // Continue avec les autres utilisateurs même en cas d'erreur
    }
  }

  return createdUsers;
}

export async function POST() {
  if (!ENABLE_SEED) {
    return NextResponse.json({ ok: false, error: 'Seed disabled' }, { status: 403 });
  }

  try {
    const db = adminDb;
    if (!db) {
      return NextResponse.json({ ok: false, error: 'Admin not configured' }, { status: 500 });
    }

    // Créer les utilisateurs de test
    console.log('Creating test users...');
    const testUsers = await createTestUsers();
    console.log(`Created ${testUsers.length} test users`);

    const batch = db.batch();
    const b2bData = buildProtocolesB2B();
    const downloads = buildDownloadsB2B();

    // Products
    for (const product of buildProducts()) {
      const ref = db.collection('products').doc(product.slug);
      batch.set(ref, {
        slug: product.slug,
        category: product.category,
        price: product.price,
        image: product.image,
        defaultLocale: 'fr',
        translations: product.translations,
      });
    }

    // Blog posts
    for (const post of buildBlogPosts()) {
      const ref = db.collection('blogPosts').doc(post.slug);
      batch.set(ref, {
        slug: post.slug,
        image: post.image,
        date: post.date,
        readTime: post.readTime,
        category: post.category,
        related: post.related,
        author: post.author,
        defaultLocale: 'fr',
        translations: post.translations,
      });
    }

    // Rituals
    for (const ritual of buildRituals()) {
      const ref = db.collection('rituals').doc(ritual.slug);
      batch.set(ref, {
        slug: ritual.slug,
        image: ritual.image,
        products: ritual.products,
        defaultLocale: 'fr',
        translations: ritual.translations,
      });
    }

    // Podcasts
    for (const pod of buildPodcasts()) {
      const ref = db.collection('podcasts').doc(pod.slug);
      batch.set(ref, {
        slug: pod.slug,
        image: pod.image,
        date: pod.date,
        duration: pod.duration,
        guest: pod.guest,
        defaultLocale: 'fr',
        translations: pod.translations,
      });
    }

    // B2B Rituels détaillés
    for (const rituel of b2bData.rituels) {
      const ref = db.collection('rituelsB2B').doc(rituel.slug);
      batch.set(ref, {
        slug: rituel.slug,
        reference: rituel.reference,
        category: rituel.category,
        image: rituel.image,
        theme: rituel.theme,
        ambiance: rituel.ambiance,
        duration: rituel.duration,
        preparation: rituel.preparation,
        deroulement: rituel.deroulement,
        retail: rituel.retail,
        notes: rituel.notes,
        defaultLocale: 'fr',
        translations: rituel.translations,
      });
    }

    // B2B Fiches techniques
    for (const fiche of b2bData.fiches) {
      const ref = db.collection('fichesTechniquesB2B').doc(fiche.slug);
      batch.set(ref, {
        slug: fiche.slug,
        reference: fiche.reference,
        category: fiche.category,
        extraction: fiche.extraction,
        volume: fiche.volume,
        image: fiche.image,
        description: fiche.description,
        proprietes: fiche.proprietes,
        actifs: fiche.actifs,
        utilisation: fiche.utilisation,
        caracteristiques: fiche.caracteristiques,
        avis_experts: fiche.avis_experts,
        defaultLocale: 'fr',
        translations: fiche.translations,
      });
    }

    // B2B Téléchargements (assets)
    for (const asset of downloads) {
      const ref = db.collection('downloadsB2B').doc(asset.slug);
      batch.set(ref, {
        slug: asset.slug,
        type: asset.type,
        category: asset.category,
        format: asset.format,
        size: asset.size,
        url: asset.url,
        defaultLocale: asset.defaultLocale || 'fr',
        translations: asset.translations,
      });
    }

    await batch.commit();
    return NextResponse.json({ 
      ok: true, 
      message: 'Seed completed successfully',
      users: testUsers,
    });
  } catch (error: unknown) {
    console.error('Seed error', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
