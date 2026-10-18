// Every word and number on the portfolio, English and French, each written natively.
// French typography: NB (no-break space) before ":", NN (narrow no-break space) before "? ! ;".
// Marks: {c:word} is circled in red pencil, {u:words} underlined, {k:words} set in the key red, {em:words} the italic voice.
// Keep the home page short and in plain words: who, what, proof, price and contact in one scroll.
// Starting prices, set 2026-10-15 from market research (French freelance medians, the Onyxlab Algeria
// barometer, Maghreb rates): above Algerian freelancers, below French seniors. Prices are set in euros;
// the dinar list is the same prices converted at `dzdPerEur` (1 € = 275 DA, the rate Mohamed uses),
// rounded to the nearest 5,000 DA. null shows "On request" / "Sur demande".

export const site = {
  url: 'https://amarselmani.github.io/',
  name: 'Mohamed Amar Selmani',
  email: 'selmanim183@gmail.com',
  phone: '+213 552 60 26 42',
  wa: '213552602642',
  github: 'https://github.com/AmarSELMANI',
  year: 2026,
  dzdPerEur: 275,
  prices: { eur: { websites: 1200, webapps: 4500, mobile: 5000, ai: 900 } },
};

site.prices.dzd = Object.fromEntries(Object.entries(site.prices.eur)
  .map(([k, v]) => [k, v == null ? null : Math.round((v * site.dzdPerEur) / 5000) * 5000]));

const NB = '\u00a0', NN = '\u202f';

// Projects shown on the light table, in order. Screens are real captures of the live demos.
export const projects = [
  { id: 'naftal', no: '14', demo: 'demos/naftal/', url: 'amarselmani.github.io/demos/naftal',
    mock: { kind: 'browser', src: 'img/naftal-ai.webp', w: 1600, h: 1000, pos: '0 0', phone: { src: 'img/naftal-ai-phone.webp', w: 780, h: 1410 } } },
  { id: 'b2b', no: '15', demo: 'demos/naftal-b2b/', url: 'amarselmani.github.io/demos/naftal-b2b',
    mock: { kind: 'browser', src: 'img/b2b-console.webp', w: 1600, h: 1001, pos: '0 0',
      phones: [{ src: 'img/b2b-catalog.webp', w: 420, h: 909 }, { src: 'img/b2b-orders.webp', w: 420, h: 909 }] } },
  { id: 'marine', no: '16', demo: 'demos/marine-bot/', url: 'amarselmani.github.io/demos/marine-bot',
    mock: { kind: 'browser', src: 'img/marine-web.webp', w: 1100, h: 1000, pos: '0 0', phone: { src: 'img/marine-telegram.webp', w: 360, h: 779 } } },
  { id: 'bn', no: '17', demo: 'demos/bn-signature/', url: 'amarselmani.github.io/demos/bn-signature',
    mock: { kind: 'browser', src: 'img/bn/deck-01.webp', w: 1600, h: 900, pos: '50% 50%' } },
];

export const T = {
  // ======================================================================== English
  en: {
    lang: 'en', other: 'fr', otherLabel: 'FR', otherName: 'Français', locale: 'en_US',
    nav: { work: 'Work', services: 'Services', about: 'About', contact: 'Contact', talk: 'Let’s talk', menu: 'Open menu', close: 'Close', main: 'Main', home: 'Mohamed Amar Selmani, home' },
    skip: 'Skip to content',
    theme: { toDark: 'Turn on the safelight (dark mode)', toLight: 'Turn the lights on (light mode)' },
    home: {
      title: 'Mohamed Amar Selmani · Full-stack & AI engineer',
      description: 'Full-stack and AI engineer in Blida, Algeria. Web platforms, mobile apps and AI systems that hold when it counts, each with a live demo.',
      hero: {
        kicker: 'Full-stack & AI engineer · Blida, Algeria',
        l1: 'Let’s build software',
        l2: 'that {c:holds} when it counts.',
        sub: 'I design and build websites, mobile apps and AI tools for businesses that can’t afford a wrong answer.',
        cta: 'Services & prices',
        work: 'See my work',
      },
      table: {
        label: 'Work',
        title: 'Four projects you can {em:try live.}',
        hint: 'Drag, swipe or use the arrows',
        prev: 'Previous project', next: 'Next project',
        of: (i, n, t) => `Project ${i} of ${n}: ${t}`,
        open: 'Try the live demo',
        selected: 'Selected',
      },
      projects: {
        naftal: { title: 'Naftal AI Platform', kind: 'AI web platform', line: 'An AI assistant that writes reports from company data. It runs on the company’s own servers, and each team sees only its own district.', alt: 'The Naftal AI dashboard for District Tébessa, on a computer and a phone' },
        b2b: { title: 'Naftal B2B', kind: 'Mobile app · iOS & Android', line: 'Business customers order tires and lubricants on credit from their phone, and Naftal’s agents approve accounts and payments in a web console.', alt: 'The Naftal B2B app: the tire catalog and the orders screen with the available credit' },
        marine: { title: 'Algerian Coast Marine Bot', kind: 'Telegram bot · AI', line: 'A daily sea-safety rating for the Algerian coast, worked out from real weather forecasts and sent on Telegram.', alt: 'The marine assessment engine in the browser, and the daily message in Telegram' },
        bn: { title: 'BN Signature', kind: 'Concept & pitch deck · BN Hotel, Blida', line: 'A way to book the hotel’s evenings and celebrations online, and the animated presentation that pitches it.', alt: 'The BN Signature presentation opening on the BN Hotel tower at golden hour' },
      },
      counts: [
        { n: 4, suffix: '', label: 'Live projects you can try' },
        { n: 3, suffix: '', label: 'Platforms: web, iOS & Android, Telegram' },
        { text: 'EN · FR', label: 'I work in English and French' },
      ],
      services: {
        label: 'Services',
        title: 'Four ways to {em:build with me.}',
        more: 'Details & prices',
        cards: [
          { id: 'websites', tag: 'Websites & landing pages', pitch: 'A site that looks like your brand and moves like a film.', body: 'Custom design that stays smooth on phones, in English, French or Arabic.' },
          { id: 'webapps', tag: 'Web apps & dashboards', pitch: 'The tools your team works in every day, with rules that hold.', body: 'Accounts and roles, a database and an API, dashboards and reports.' },
          { id: 'mobile', tag: 'Mobile apps', pitch: 'One app for iOS and Android, connected to your business.', body: 'React Native and Expo, tested on real phones.' },
          { id: 'ai', tag: 'AI assistants & bots', pitch: 'Answers from your documents, and bots that do the repetitive work.', body: 'Local models when your data must stay in-house. Telegram and WhatsApp bots.' },
        ],
      },
      about: {
        label: 'About',
        title: 'Hey, I’m {c:Mohamed}.',
        role: 'Full-stack & AI engineer',
        body: [
          'I’m a Master’s student in Artificial Intelligence at Saad Dahlab University, Blida 1, and I build software for businesses where a mistake costs money: orders on credit, reports people act on, bookings.',
          'Every project ships with tests that prove its rules work, and an honest note of what it doesn’t do yet.',
        ],
        stack: ['React', 'React Native', 'TypeScript', 'Node.js', 'Python', 'PostgreSQL', 'AI & LLMs'],
        github: 'GitHub profile',
        alt: 'Mohamed Amar Selmani at his desk',
      },
    },
    services: {
      title: 'Services & prices · Mohamed Amar Selmani',
      description: 'Websites, web apps, mobile apps and AI assistants by Mohamed Amar Selmani, with a starting price for each.',
      hero: {
        label: 'Let’s work together',
        title: 'Four ways to {em:build with me.}',
        lead: 'Websites, web apps, mobile apps and AI assistants. Every project starts with a conversation and a written scope; the prices below are where a project starts.',
        alts: ['The Naftal B2B app', 'The Naftal AI platform on a phone', 'The Marine Bot message in Telegram'],
      },
      tablist: 'Services',
      from: 'From', onRequest: 'On request', price: 'Starting price',
      currency: { label: 'Prices for', eur: 'International · €', dzd: 'Algeria · DA', note: 'Dinar prices at 1 € = 275 DA. Every project gets a written quote.' },
      includes: 'Included', seen: 'Seen in',
      cta: 'Discuss it on WhatsApp', email: 'Or by email',
      waText: (s) => `Hello Mohamed, I would like to discuss a project: ${s}.`,
      items: [
        { id: 'websites', tab: 'Websites', tag: 'Websites & landing pages', pitch: 'A site that looks like your brand and moves like a film.',
          body: 'For businesses, hotels, restaurants and brands that want to be remembered. Designed from scratch, animated with care, and fast on a phone over a mobile connection.',
          list: ['Custom design, light and dark', 'Motion that stays smooth on phones', 'English, French and Arabic', 'Contact or booking form', 'Search basics and visitor statistics'],
          proof: [['BN Signature', 'demos/bn-signature/'], ['this portfolio', null]] },
        { id: 'webapps', tab: 'Web apps', tag: 'Web apps & dashboards', pitch: 'The tools your team works in every day, with rules that hold.',
          body: 'Client portals, back offices and internal tools. The business rules live on the server and are proven by tests, so the numbers on the dashboard are the numbers in the database.',
          list: ['Accounts, roles and permissions', 'Database and API', 'Admin back office and dashboards', 'Exports and reports', 'Tests that prove the business rules'],
          proof: [['Naftal AI Platform', 'demos/naftal/']] },
        { id: 'mobile', tab: 'Mobile apps', tag: 'Mobile apps', pitch: 'One app for iOS and Android, connected to your business.',
          body: 'Ordering, booking and field apps built with React Native and Expo, from one codebase, connected to your existing API or to a new one.',
          list: ['iOS and Android from one codebase', 'Connected to your API, or a new one', 'Notifications', 'Account and ordering flows', 'Tested on real phones'],
          proof: [['Naftal B2B', 'demos/naftal-b2b/']] },
        { id: 'ai', tab: 'AI & bots', tag: 'AI assistants, bots & automation', pitch: 'Answers from your documents, and bots that do the repetitive work.',
          body: 'Assistants that cite their sources, bots on Telegram and WhatsApp, and automation for repetitive tasks. Your rules make the decisions; the AI only writes the words.',
          list: ['Answers from your documents, with sources', 'Local models: your data stays on your server', 'Telegram and WhatsApp bots', 'Automation of repetitive tasks', 'Your rules decide; the AI only writes'],
          proof: [['Marine Bot', 'demos/marine-bot/'], ['Naftal AI', 'demos/naftal/']] },
      ],
      process: {
        label: 'How it works',
        title: 'From first message {em:to launch.}',
        steps: [
          ['Conversation', 'Your goals, your users, your constraints.'],
          ['Scope & quote', 'A written scope and a quote before the build starts.'],
          ['Build', 'Regular demos you can click, not status reports.'],
          ['Launch', 'Deployment, handover, and documentation of what it does not do yet.'],
        ],
      },
    },
    contact: {
      label: 'Contact',
      title: 'Have a project? Let’s {c:talk}.',
      lead: 'Tell me what you need and I’ll reply on WhatsApp or by email. Also open to engineering jobs, internships and collaborations.',
      form: {
        name: 'Your name', namePh: 'Example: Nadia K.',
        need: 'What do you need?',
        needs: ['A website', 'A web app', 'A mobile app', 'An AI assistant or bot', 'A job or internship', 'Something else'],
        message: 'Your message', messagePh: 'Example: a booking site for my restaurant, in French and Arabic.',
        error: 'Write a few words about your project so I can reply properly.',
        wa: 'Send on WhatsApp', mail: 'Send by email',
        note: 'This opens WhatsApp or your email app with your message ready. Nothing is stored on this site.',
        tHello: 'Hello Mohamed,', tName: ' I’m {name}.', tNeeds: ' I need: {needs}.', lowerNeeds: false,
        subject: 'Project inquiry',
      },
    },
    footer: {
      bio: 'Full-stack and AI engineer in Blida, Algeria. Websites, mobile apps and AI tools that hold when it counts.',
      pages: 'Pages', demos: 'Live demos', elsewhere: 'Elsewhere',
      demoNames: ['Naftal AI Platform', 'Naftal B2B', 'Marine Bot', 'BN Signature'],
      made: 'Designed and built by me',
      top: 'Back to top',
    },
    money: { eur: (n) => '€' + n.toLocaleString('en-US'), dzd: (n) => n.toLocaleString('en-US') + NB + 'DA' },
  },

  // ======================================================================== Français
  fr: {
    lang: 'fr', other: 'en', otherLabel: 'EN', otherName: 'English', locale: 'fr_FR',
    nav: { work: 'Projets', services: 'Services', about: 'À propos', contact: 'Contact', talk: 'Parlons-en', menu: 'Ouvrir le menu', close: 'Fermer', main: 'Navigation principale', home: 'Mohamed Amar Selmani, accueil' },
    skip: 'Aller au contenu',
    theme: { toDark: 'Allumer la lumière inactinique (mode sombre)', toLight: 'Rallumer la lumière (mode clair)' },
    home: {
      title: 'Mohamed Amar Selmani · Ingénieur full-stack et IA',
      description: 'Ingénieur full-stack et IA à Blida, en Algérie. Plateformes web, applications mobiles et systèmes d’IA qui tiennent quand ça compte, chacun avec une démo en ligne.',
      hero: {
        kicker: 'Ingénieur full-stack et IA · Blida, Algérie',
        l1: 'Construisons un logiciel',
        l2: 'qui {c:tient} quand ça compte.',
        sub: 'Je conçois et développe des sites, des applications mobiles et des outils d’IA pour les entreprises qui ne peuvent pas se permettre une mauvaise réponse.',
        cta: 'Services et tarifs',
        work: 'Voir mes projets',
      },
      table: {
        label: 'Projets',
        title: 'Quatre projets à {em:essayer en ligne.}',
        hint: 'Faites glisser ou utilisez les flèches',
        prev: 'Projet précédent', next: 'Projet suivant',
        of: (i, n, t) => `Projet ${i} sur ${n}${NB}: ${t}`,
        open: 'Essayer la démo',
        selected: 'Choisi',
      },
      projects: {
        naftal: { title: 'Naftal AI Platform', kind: 'Plateforme web IA', line: 'Un assistant IA qui rédige des rapports à partir des données de l’entreprise. Il tourne sur ses propres serveurs, et chaque équipe ne voit que son district.', alt: 'Le tableau de bord Naftal AI du district de Tébessa, sur ordinateur et sur téléphone' },
        b2b: { title: 'Naftal B2B', kind: 'Application mobile · iOS et Android', line: 'Les clients professionnels commandent pneus et lubrifiants à crédit depuis leur téléphone, et les agents de Naftal valident comptes et paiements dans une console web.', alt: 'L’application Naftal B2B' + NB + ': le catalogue de pneus et l’écran des commandes avec le crédit disponible' },
        marine: { title: 'Algerian Coast Marine Bot', kind: 'Bot Telegram · IA', line: 'Une note de sécurité en mer chaque jour pour la côte algérienne, calculée à partir de vraies prévisions météo et envoyée sur Telegram.', alt: 'Le moteur d’évaluation marine dans le navigateur, et le message du jour dans Telegram' },
        bn: { title: 'BN Signature', kind: 'Concept et présentation · BN Hotel, Blida', line: 'Réserver en ligne les soirées et les célébrations d’un hôtel, et la présentation animée qui défend le projet.', alt: 'La présentation BN Signature s’ouvre sur la tour du BN Hotel au coucher du soleil' },
      },
      counts: [
        { n: 4, suffix: '', label: 'Projets en ligne à essayer' },
        { n: 3, suffix: '', label: 'Plateformes' + NB + ': web, iOS et Android, Telegram' },
        { text: 'FR · EN', label: 'Je travaille en français et en anglais' },
      ],
      services: {
        label: 'Services',
        title: 'Quatre façons de {em:construire ensemble.}',
        more: 'Détails et tarifs',
        cards: [
          { id: 'websites', tag: 'Sites vitrines et landing pages', pitch: 'Un site à l’image de votre marque, animé comme un film.', body: 'Un design sur mesure, fluide sur téléphone, en français, en anglais ou en arabe.' },
          { id: 'webapps', tag: 'Applications web et tableaux de bord', pitch: 'Les outils de votre équipe, avec des règles qui tiennent.', body: 'Comptes et rôles, base de données et API, tableaux de bord et rapports.' },
          { id: 'mobile', tag: 'Applications mobiles', pitch: 'Une seule application pour iOS et Android, reliée à votre activité.', body: 'React Native et Expo, testée sur de vrais téléphones.' },
          { id: 'ai', tag: 'Assistants IA et bots', pitch: 'Des réponses tirées de vos documents, et des bots pour le travail répétitif.', body: 'Des modèles locaux quand vos données doivent rester chez vous. Bots Telegram et WhatsApp.' },
        ],
      },
      about: {
        label: 'À propos',
        title: 'Bonjour, moi c’est {c:Mohamed}.',
        role: 'Ingénieur full-stack et IA',
        body: [
          'Étudiant en master d’Intelligence artificielle à l’Université Saad Dahlab, Blida 1, je construis des logiciels pour les entreprises où une erreur coûte cher' + NB + ': des commandes à crédit, des rapports sur lesquels on agit, des réservations.',
          'Chaque projet est livré avec des tests qui prouvent que ses règles tiennent, et une note honnête sur ce qu’il ne fait pas encore.',
        ],
        stack: ['React', 'React Native', 'TypeScript', 'Node.js', 'Python', 'PostgreSQL', 'IA et LLM'],
        github: 'Profil GitHub',
        alt: 'Mohamed Amar Selmani à son bureau',
      },
    },
    services: {
      title: 'Services et tarifs · Mohamed Amar Selmani',
      description: 'Sites, applications web, applications mobiles et assistants IA par Mohamed Amar Selmani, avec un prix de départ pour chacun.',
      hero: {
        label: 'Travaillons ensemble',
        title: 'Quatre façons de {em:construire ensemble.}',
        lead: 'Sites, applications web, applications mobiles et assistants IA. Chaque projet commence par une discussion et un périmètre écrit' + NN + '; les prix ci-dessous sont des points de départ.',
        alts: ['L’application Naftal B2B', 'La plateforme Naftal AI sur téléphone', 'Le message du Marine Bot dans Telegram'],
      },
      tablist: 'Services',
      from: 'À partir de', onRequest: 'Sur demande', price: 'Prix de départ',
      currency: { label: 'Tarifs pour', eur: 'International · €', dzd: 'Algérie · DA', note: 'Prix en dinars à 1' + NB + '€ = 275' + NB + 'DA. Chaque projet fait l’objet d’un devis écrit.' },
      includes: 'Inclus', seen: 'Exemples',
      cta: 'En parler sur WhatsApp', email: 'Ou par e-mail',
      waText: (s) => `Bonjour Mohamed, j’aimerais parler d’un projet${NB}: ${s}.`,
      items: [
        { id: 'websites', tab: 'Sites', tag: 'Sites vitrines et landing pages', pitch: 'Un site à l’image de votre marque, animé comme un film.',
          body: 'Pour les entreprises, hôtels, restaurants et marques qui veulent marquer les esprits. Conçu de zéro, animé avec soin, et rapide sur un téléphone en 4G.',
          list: ['Design sur mesure, mode clair et sombre', 'Des animations fluides, même sur téléphone', 'Français, anglais et arabe', 'Formulaire de contact ou de réservation', 'Référencement de base et statistiques de visite'],
          proof: [['BN Signature', 'demos/bn-signature/'], ['ce portfolio', null]] },
        { id: 'webapps', tab: 'Applications web', tag: 'Applications web et tableaux de bord', pitch: 'Les outils de votre équipe, avec des règles qui tiennent.',
          body: 'Portails clients, back-offices et outils internes. Les règles métier vivent sur le serveur et sont prouvées par des tests' + NB + ': les chiffres du tableau de bord sont ceux de la base.',
          list: ['Comptes, rôles et permissions', 'Base de données et API', 'Back-office et tableaux de bord', 'Exports et rapports', 'Des tests qui prouvent les règles métier'],
          proof: [['Naftal AI Platform', 'demos/naftal/']] },
        { id: 'mobile', tab: 'Applications mobiles', tag: 'Applications mobiles', pitch: 'Une seule application pour iOS et Android, reliée à votre activité.',
          body: 'Applications de commande, de réservation ou de terrain en React Native et Expo, avec un seul code, reliées à votre API ou à une nouvelle.',
          list: ['iOS et Android, un seul code', 'Reliée à votre API, ou à une nouvelle', 'Notifications', 'Parcours de compte et de commande', 'Testée sur de vrais téléphones'],
          proof: [['Naftal B2B', 'demos/naftal-b2b/']] },
        { id: 'ai', tab: 'IA et bots', tag: 'Assistants IA, bots et automatisation', pitch: 'Des réponses tirées de vos documents, et des bots pour le travail répétitif.',
          body: 'Des assistants qui citent leurs sources, des bots Telegram et WhatsApp, et l’automatisation des tâches répétitives. Vos règles prennent les décisions' + NN + '; l’IA ne fait qu’écrire.',
          list: ['Des réponses tirées de vos documents, avec les sources', 'Modèles locaux' + NB + ': vos données restent sur votre serveur', 'Bots Telegram et WhatsApp', 'Automatisation des tâches répétitives', 'Vos règles décident' + NN + '; l’IA ne fait que rédiger'],
          proof: [['Marine Bot', 'demos/marine-bot/'], ['Naftal AI', 'demos/naftal/']] },
      ],
      process: {
        label: 'Déroulement',
        title: 'Du premier message {em:au lancement.}',
        steps: [
          ['Discussion', 'Vos objectifs, vos utilisateurs, vos contraintes.'],
          ['Périmètre et devis', 'Un périmètre écrit et un devis avant le début du développement.'],
          ['Réalisation', 'Des démos à cliquer régulièrement, pas des rapports d’avancement.'],
          ['Lancement', 'Mise en ligne, passation, et la documentation de ce qu’il ne fait pas encore.'],
        ],
      },
    },
    contact: {
      label: 'Contact',
      title: 'Un projet' + NN + '? {c:Parlons}-en.',
      lead: 'Dites-moi ce dont vous avez besoin, je vous réponds sur WhatsApp ou par e-mail. Également ouvert aux postes d’ingénieur, aux stages et aux collaborations.',
      form: {
        name: 'Votre nom', namePh: 'Exemple' + NB + ': Nadia K.',
        need: 'De quoi avez-vous besoin' + NN + '?',
        needs: ['Un site', 'Une application web', 'Une application mobile', 'Un assistant IA ou un bot', 'Un poste ou un stage', 'Autre chose'],
        message: 'Votre message', messagePh: 'Exemple' + NB + ': un site de réservation pour mon restaurant, en français et en arabe.',
        error: 'Écrivez quelques mots sur votre projet pour que je puisse bien vous répondre.',
        wa: 'Envoyer sur WhatsApp', mail: 'Envoyer par e-mail',
        note: 'Cela ouvre WhatsApp ou votre messagerie avec votre message prêt. Rien n’est enregistré sur ce site.',
        tHello: 'Bonjour Mohamed,', tName: ' Je suis {name}.', tNeeds: ' J’ai besoin de' + NB + ': {needs}.', lowerNeeds: true,
        subject: 'Demande de projet',
      },
    },
    footer: {
      bio: 'Ingénieur full-stack et IA à Blida, en Algérie. Des sites, des applications mobiles et des outils d’IA qui tiennent quand ça compte.',
      pages: 'Pages', demos: 'Démos en ligne', elsewhere: 'Ailleurs',
      demoNames: ['Naftal AI Platform', 'Naftal B2B', 'Marine Bot', 'BN Signature'],
      made: 'Conçu et développé par moi',
      top: 'Retour en haut',
    },
    money: {
      eur: (n) => n.toLocaleString('fr-FR').replace(/\s/g, NN) + NB + '€',
      dzd: (n) => n.toLocaleString('fr-FR').replace(/\s/g, NN) + NB + 'DA',
    },
  },
};
