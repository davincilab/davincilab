/*
 * data.js — assortment, option groups and translations.
 *
 * Prices follow the printed board of the beach bar (photo), rounded to the
 * values that were legible. Every name exists in English and Greek.
 */
(function (global) {
  'use strict';

  var CATEGORIES = [
    { id: 'coffee', icon: '☕', name: { en: 'Coffee', el: 'Καφές' } },
    { id: 'soft', icon: '🥤', name: { en: 'Soft drinks', el: 'Αναψυκτικά' } },
    { id: 'juice', icon: '🍹', name: { en: 'Juices', el: 'Χυμοί' } },
    { id: 'beer', icon: '🍺', name: { en: 'Beers', el: 'Μπύρες' } },
    { id: 'cocktail', icon: '🍸', name: { en: 'Cocktails', el: 'Κοκτέιλ' } },
    { id: 'snack', icon: '🥪', name: { en: 'Snacks', el: 'Σνακ' } }
  ];

  /* Option groups. `type` is single|multi, `delta` is the price surcharge. */
  var OPTION_GROUPS = {
    sugar: {
      type: 'single',
      required: true,
      name: { en: 'Sugar', el: 'Ζάχαρη' },
      choices: [
        { id: 'none', delta: 0, name: { en: 'No sugar', el: 'Σκέτος (χωρίς ζάχαρη)' } },
        { id: 'little', delta: 0, name: { en: 'Little sugar', el: 'Λίγη ζάχαρη' } },
        { id: 'medium', delta: 0, name: { en: 'Medium', el: 'Μέτριος' } },
        { id: 'sweet', delta: 0, name: { en: 'Very sweet', el: 'Γλυκός (πολλή ζάχαρη)' } }
      ]
    },
    milk: {
      type: 'single',
      required: true,
      name: { en: 'Milk', el: 'Γάλα' },
      choices: [
        { id: 'regular', delta: 0, name: { en: 'Regular milk', el: 'Πλήρες γάλα' } },
        { id: 'light', delta: 0, name: { en: 'Low fat', el: 'Ημιαποβουτυρωμένο' } },
        { id: 'oat', delta: 0.5, name: { en: 'Oat milk', el: 'Γάλα βρώμης' } },
        { id: 'none', delta: 0, name: { en: 'Without milk', el: 'Χωρίς γάλα' } }
      ]
    },
    colaVariant: {
      type: 'single',
      required: true,
      name: { en: 'Variant', el: 'Είδος' },
      choices: [
        { id: 'regular', delta: 0, name: { en: 'Regular', el: 'Κανονική' } },
        { id: 'zero', delta: 0, name: { en: 'Zero', el: 'Zero' } }
      ]
    },
    teaFlavour: {
      type: 'single',
      required: true,
      name: { en: 'Flavour', el: 'Γεύση' },
      choices: [
        { id: 'lemon', delta: 0, name: { en: 'Lemon', el: 'Λεμόνι' } },
        { id: 'peach', delta: 0, name: { en: 'Peach', el: 'Ροδάκινο' } }
      ]
    },
    sweeten: {
      type: 'single',
      required: true,
      name: { en: 'Sweetness', el: 'Γλυκύτητα' },
      choices: [
        { id: 'none', delta: 0, name: { en: 'Without sugar', el: 'Χωρίς ζάχαρη' } },
        { id: 'little', delta: 0, name: { en: 'Little sugar', el: 'Λίγη ζάχαρη' } },
        { id: 'normal', delta: 0, name: { en: 'With sugar', el: 'Με ζάχαρη' } }
      ]
    },
    smoothieFlavour: {
      type: 'single',
      required: true,
      name: { en: 'Flavour', el: 'Γεύση' },
      choices: [
        { id: 'banana', delta: 0, name: { en: 'Banana', el: 'Μπανάνα' } },
        { id: 'strawberry', delta: 0, name: { en: 'Strawberry', el: 'Φράουλα' } },
        { id: 'mango', delta: 0, name: { en: 'Mango', el: 'Μάνγκο' } },
        { id: 'mixed', delta: 0, name: { en: 'Mixed fruit', el: 'Ανάμεικτο' } }
      ]
    },
    toastFilling: {
      type: 'single',
      required: true,
      name: { en: 'Filling', el: 'Γέμιση' },
      choices: [
        { id: 'hamcheese', delta: 0, name: { en: 'Ham & cheese', el: 'Ζαμπόν & τυρί' } },
        { id: 'cheese', delta: 0, name: { en: 'Cheese only', el: 'Μόνο τυρί' } },
        { id: 'veggie', delta: 0, name: { en: 'Cheese & tomato', el: 'Τυρί & ντομάτα' } }
      ]
    },
    burgerExtras: {
      type: 'multi',
      required: false,
      name: { en: 'Extras', el: 'Έξτρα' },
      choices: [
        { id: 'bacon', delta: 1.5, name: { en: 'Bacon', el: 'Μπέικον' } },
        { id: 'cheese', delta: 1, name: { en: 'Extra cheese', el: 'Έξτρα τυρί' } },
        { id: 'noonion', delta: 0, name: { en: 'No onion', el: 'Χωρίς κρεμμύδι' } },
        { id: 'nosauce', delta: 0, name: { en: 'No sauce', el: 'Χωρίς σως' } }
      ]
    },
    ice: {
      type: 'single',
      required: true,
      name: { en: 'Ice', el: 'Πάγος' },
      choices: [
        { id: 'normal', delta: 0, name: { en: 'Normal ice', el: 'Κανονικός πάγος' } },
        { id: 'little', delta: 0, name: { en: 'Little ice', el: 'Λίγος πάγος' } },
        { id: 'none', delta: 0, name: { en: 'No ice', el: 'Χωρίς πάγο' } }
      ]
    }
  };

  /* The 20 products. `station` routes the ticket inside the bar. */
  var MENU = [
    { id: 'greek_coffee', cat: 'coffee', price: 3.5, station: 'bar', emoji: '☕',
      name: { en: 'Greek coffee', el: 'Ελληνικός καφές' },
      desc: { en: 'Traditional, in a briki', el: 'Παραδοσιακός, στο μπρίκι' },
      options: ['sugar'] },
    { id: 'espresso', cat: 'coffee', price: 3.5, station: 'bar', emoji: '☕',
      name: { en: 'Espresso', el: 'Εσπρέσσο' },
      desc: { en: 'Single shot, hot', el: 'Μονός, ζεστός' },
      options: ['sugar'] },
    { id: 'freddo_espresso', cat: 'coffee', price: 5, station: 'bar', emoji: '🧊',
      name: { en: 'Freddo Espresso', el: 'Φρέντο Εσπρέσσο' },
      desc: { en: 'Iced espresso, shaken', el: 'Παγωμένος εσπρέσσο' },
      options: ['sugar', 'ice'] },
    { id: 'freddo_cappuccino', cat: 'coffee', price: 5.5, station: 'bar', emoji: '🧊',
      name: { en: 'Freddo Cappuccino', el: 'Φρέντο Καπουτσίνο' },
      desc: { en: 'With cold milk foam', el: 'Με αφρόγαλα' },
      options: ['sugar', 'milk', 'ice'] },

    { id: 'water', cat: 'soft', price: 1, station: 'bar', emoji: '💧',
      name: { en: 'Water 0.5 l', el: 'Νερό 0,5 λ' },
      desc: { en: 'Chilled bottle', el: 'Παγωμένο μπουκάλι' },
      options: [] },
    { id: 'sparkling_water', cat: 'soft', price: 4, station: 'bar', emoji: '🫧',
      name: { en: 'Sparkling water', el: 'Ανθρακούχο νερό' },
      desc: { en: '330 ml', el: '330 ml' },
      options: ['ice'] },
    { id: 'coca_cola', cat: 'soft', price: 4, station: 'bar', emoji: '🥤',
      name: { en: 'Coca Cola', el: 'Κόκα Κόλα' },
      desc: { en: 'Regular or Zero', el: 'Κανονική ή Zero' },
      options: ['colaVariant', 'ice'] },
    { id: 'ice_tea', cat: 'soft', price: 4, station: 'bar', emoji: '🧋',
      name: { en: 'Ice tea', el: 'Τσάι κρύο' },
      desc: { en: 'Lemon or peach', el: 'Λεμόνι ή ροδάκινο' },
      options: ['teaFlavour', 'ice'] },

    { id: 'fresh_orange', cat: 'juice', price: 6, station: 'bar', emoji: '🍊',
      name: { en: 'Fresh orange juice', el: 'Φυσικός χυμός πορτοκάλι' },
      desc: { en: 'Freshly squeezed', el: 'Φρεσκοστυμμένος' },
      options: ['sweeten', 'ice'] },
    { id: 'homemade_lemonade', cat: 'juice', price: 6, station: 'bar', emoji: '🍋',
      name: { en: 'Homemade lemonade', el: 'Σπιτική λεμονάδα' },
      desc: { en: 'With fresh mint', el: 'Με φρέσκο δυόσμο' },
      options: ['sweeten', 'ice'] },
    { id: 'smoothie', cat: 'juice', price: 6.5, station: 'bar', emoji: '🥭',
      name: { en: 'Smoothie', el: 'Σμούθι' },
      desc: { en: 'Fruit, ice, no added sugar', el: 'Φρούτα, πάγος, χωρίς ζάχαρη' },
      options: ['smoothieFlavour'] },

    { id: 'amstel', cat: 'beer', price: 5, station: 'bar', emoji: '🍺',
      name: { en: 'Amstel 0.33 l', el: 'Άμστελ 0,33 λ' },
      desc: { en: 'Bottle', el: 'Μπουκάλι' },
      options: [] },
    { id: 'heineken', cat: 'beer', price: 5, station: 'bar', emoji: '🍺',
      name: { en: 'Heineken 0.33 l', el: 'Χάινεκεν 0,33 λ' },
      desc: { en: 'Bottle', el: 'Μπουκάλι' },
      options: [] },
    { id: 'draft_big', cat: 'beer', price: 7, station: 'bar', emoji: '🍻',
      name: { en: 'Draft beer, large', el: 'Βαρέλι μεγάλο' },
      desc: { en: '0.5 l from the tap', el: '0,5 λ από τη βρύση' },
      options: [] },

    { id: 'mojito', cat: 'cocktail', price: 10, station: 'cocktail', emoji: '🍸',
      name: { en: 'Mojito', el: 'Μοχίτο' },
      desc: { en: 'Rum, lime, mint, soda', el: 'Ρούμι, λάιμ, δυόσμος, σόδα' },
      options: ['ice'] },
    { id: 'caipirinha', cat: 'cocktail', price: 10, station: 'cocktail', emoji: '🍸',
      name: { en: 'Caipirinha', el: 'Καϊπιρίνια' },
      desc: { en: 'Cachaça, lime, sugar', el: 'Κασάσα, λάιμ, ζάχαρη' },
      options: ['ice'] },
    { id: 'tequila_sunrise', cat: 'cocktail', price: 10, station: 'cocktail', emoji: '🌅',
      name: { en: 'Tequila Sunrise', el: 'Τεκίλα Σανράιζ' },
      desc: { en: 'Tequila, orange, grenadine', el: 'Τεκίλα, πορτοκάλι, γρεναδίνη' },
      options: ['ice'] },

    { id: 'toast', cat: 'snack', price: 4, station: 'kitchen', emoji: '🥪',
      name: { en: 'Toast', el: 'Τοστ' },
      desc: { en: 'Grilled sandwich', el: 'Ψητό σάντουιτς' },
      options: ['toastFilling'] },
    { id: 'fruit_salad', cat: 'snack', price: 7, station: 'kitchen', emoji: '🍉',
      name: { en: 'Fruit salad', el: 'Φρουτοσαλάτα' },
      desc: { en: 'Seasonal fruit', el: 'Φρούτα εποχής' },
      options: [] },
    { id: 'cheeseburger', cat: 'snack', price: 8.5, station: 'kitchen', emoji: '🍔',
      name: { en: 'Cheeseburger', el: 'Τσίζμπεργκερ' },
      desc: { en: 'Beef, cheese, salad, fries', el: 'Μοσχάρι, τυρί, σαλάτα, πατάτες' },
      options: ['burgerExtras'] }
  ];

  var STRINGS = {
    /* generic */
    appGuest: { en: 'Beach Bar', el: 'Beach Bar' },
    appBar: { en: 'Bar station', el: 'Σταθμός μπαρ' },
    umbrella: { en: 'Umbrella', el: 'Ομπρέλα' },
    menu: { en: 'Menu', el: 'Κατάλογος' },
    cart: { en: 'Cart', el: 'Καλάθι' },
    orders: { en: 'Orders', el: 'Παραγγελίες' },
    account: { en: 'Account', el: 'Λογαριασμός' },
    total: { en: 'Total', el: 'Σύνολο' },
    subtotal: { en: 'Subtotal', el: 'Μερικό σύνολο' },
    add: { en: 'Add', el: 'Προσθήκη' },
    addToCart: { en: 'Add to cart', el: 'Προσθήκη στο καλάθι' },
    back: { en: 'Back', el: 'Πίσω' },
    close: { en: 'Close', el: 'Κλείσιμο' },
    cancel: { en: 'Cancel', el: 'Ακύρωση' },
    save: { en: 'Save', el: 'Αποθήκευση' },
    note: { en: 'Note', el: 'Σημείωση' },
    notePlaceholder: { en: 'e.g. no straw, extra napkins', el: 'π.χ. χωρίς καλαμάκι' },
    optional: { en: 'optional', el: 'προαιρετικό' },
    quantity: { en: 'Quantity', el: 'Ποσότητα' },
    language: { en: 'Language', el: 'Γλώσσα' },
    items: { en: 'items', el: 'είδη' },
    item: { en: 'item', el: 'είδος' },
    emptyCart: { en: 'Your cart is empty', el: 'Το καλάθι σας είναι άδειο' },
    emptyCartHint: { en: 'Pick something from the menu — we bring it to your umbrella.',
      el: 'Διαλέξτε κάτι από τον κατάλογο — το φέρνουμε στην ομπρέλα σας.' },
    /* guest flow */
    welcome: { en: 'Welcome to umbrella', el: 'Καλώς ήρθατε στην ομπρέλα' },
    orderNow: { en: 'Place order', el: 'Αποστολή παραγγελίας' },
    yourOrders: { en: 'Your orders', el: 'Οι παραγγελίες σας' },
    noOrders: { en: 'No orders yet', el: 'Καμία παραγγελία ακόμη' },
    orderPlaced: { en: 'Order received!', el: 'Η παραγγελία ελήφθη!' },
    orderPlacedHint: { en: 'The bar has your order. You can follow it here.',
      el: 'Το μπαρ έλαβε την παραγγελία. Μπορείτε να την παρακολουθείτε εδώ.' },
    eta: { en: 'Estimated delivery', el: 'Εκτιμώμενη παράδοση' },
    minutes: { en: 'min', el: 'λεπτά' },
    musicWish: { en: 'Music request', el: 'Μουσικό αίτημα' },
    musicWishHint: { en: 'A song you would like to hear', el: 'Ένα τραγούδι που θα θέλατε' },
    musicPlaceholder: { en: 'Artist – Song', el: 'Καλλιτέχνης – Τραγούδι' },
    sendWish: { en: 'Send request', el: 'Αποστολή αιτήματος' },
    wishSent: { en: 'Music request sent 🎵', el: 'Το μουσικό αίτημα στάλθηκε 🎵' },
    /* payment */
    payment: { en: 'Payment', el: 'Πληρωμή' },
    paymentMethod: { en: 'Payment method', el: 'Τρόπος πληρωμής' },
    payNow: { en: 'Pay now by card', el: 'Πληρωμή τώρα με κάρτα' },
    payTab: { en: 'Put on my tab', el: 'Στον λογαριασμό μου' },
    payTabHint: { en: 'Pay everything at the end', el: 'Πληρωμή όλων στο τέλος' },
    payCash: { en: 'Cash at the umbrella', el: 'Μετρητά στην ομπρέλα' },
    card: { en: 'Card', el: 'Κάρτα' },
    addCard: { en: 'Add a card', el: 'Προσθήκη κάρτας' },
    cardStored: { en: 'Card saved on this device', el: 'Η κάρτα αποθηκεύτηκε σε αυτή τη συσκευή' },
    cardHolder: { en: 'Card holder', el: 'Κάτοχος κάρτας' },
    cardNumber: { en: 'Card number', el: 'Αριθμός κάρτας' },
    expiry: { en: 'Expiry', el: 'Λήξη' },
    cvc: { en: 'CVC', el: 'CVC' },
    removeCard: { en: 'Remove card', el: 'Αφαίρεση κάρτας' },
    paying: { en: 'Contacting the bank…', el: 'Επικοινωνία με την τράπεζα…' },
    paid: { en: 'Paid', el: 'Πληρωμένο' },
    open: { en: 'Open', el: 'Ανοιχτό' },
    openTab: { en: 'Open tab', el: 'Ανοιχτός λογαριασμός' },
    payTabNow: { en: 'Pay tab now', el: 'Πληρωμή λογαριασμού' },
    invoice: { en: 'Invoice', el: 'Απόδειξη' },
    invoiceEmail: { en: 'Invoice by e-mail', el: 'Απόδειξη με e-mail' },
    emailPlaceholder: { en: 'you@example.com', el: 'you@example.com' },
    sendInvoice: { en: 'Send invoice', el: 'Αποστολή απόδειξης' },
    invoiceSent: { en: 'Invoice sent to', el: 'Η απόδειξη στάλθηκε στο' },
    vatIncluded: { en: 'incl. 24% VAT', el: 'με ΦΠΑ 24%' },
    demoNotice: { en: 'Prototype — no real payment is processed.',
      el: 'Πρωτότυπο — δεν γίνεται πραγματική πληρωμή.' },
    /* statuses */
    status_new: { en: 'Received', el: 'Ελήφθη' },
    status_preparing: { en: 'Preparing', el: 'Ετοιμάζεται' },
    status_ready: { en: 'On the way', el: 'Καθ’ οδόν' },
    status_served: { en: 'Delivered', el: 'Παραδόθηκε' },
    status_cancelled: { en: 'Cancelled', el: 'Ακυρώθηκε' },
    /* bar app */
    station: { en: 'Station', el: 'Σταθμός' },
    newOrders: { en: 'New', el: 'Νέες' },
    inPreparation: { en: 'In preparation', el: 'Σε ετοιμασία' },
    ready: { en: 'Ready / on the way', el: 'Έτοιμες / καθ’ οδόν' },
    done: { en: 'Delivered', el: 'Παραδομένες' },
    accept: { en: 'Accept', el: 'Αποδοχή' },
    markReady: { en: 'Ready', el: 'Έτοιμη' },
    markServed: { en: 'Delivered', el: 'Παραδόθηκε' },
    manualOrder: { en: 'Manual order', el: 'Χειροκίνητη παραγγελία' },
    allUmbrellas: { en: 'All umbrellas', el: 'Όλες οι ομπρέλες' },
    sound: { en: 'Sound', el: 'Ήχος' },
    music: { en: 'Music', el: 'Μουσική' },
    played: { en: 'Played', el: 'Παίχτηκε' },
    decline: { en: 'Decline', el: 'Απόρριψη' },
    dashboard: { en: 'Dashboard', el: 'Πίνακας ελέγχου' },
    umbrellas: { en: 'Umbrellas', el: 'Ομπρέλες' },
    noOpenOrders: { en: 'No open orders — enjoy the sun.',
      el: 'Καμία ανοιχτή παραγγελία — απολαύστε τον ήλιο.' },
    waitingSince: { en: 'waiting', el: 'αναμονή' },
    /* dashboard */
    revenueToday: { en: 'Revenue today', el: 'Έσοδα σήμερα' },
    ordersToday: { en: 'Orders today', el: 'Παραγγελίες σήμερα' },
    avgTicket: { en: 'Average order', el: 'Μέση παραγγελία' },
    openOrders: { en: 'Open orders', el: 'Ανοιχτές παραγγελίες' },
    activeUmbrellas: { en: 'Active umbrellas', el: 'Ενεργές ομπρέλες' },
    avgPrepTime: { en: 'Avg. preparation', el: 'Μέσος χρόνος ετοιμασίας' },
    revenueByHour: { en: 'Revenue by hour', el: 'Έσοδα ανά ώρα' },
    topItems: { en: 'Top products', el: 'Κορυφαία προϊόντα' },
    categoryShare: { en: 'Revenue by category', el: 'Έσοδα ανά κατηγορία' },
    umbrellaMap: { en: 'Revenue per umbrella', el: 'Έσοδα ανά ομπρέλα' },
    openTabs: { en: 'Open tabs', el: 'Ανοιχτοί λογαριασμοί' },
    sentInvoices: { en: 'Sent invoices', el: 'Απεσταλμένες αποδείξεις' },
    exportCsv: { en: 'Export CSV', el: 'Εξαγωγή CSV' },
    resetDemo: { en: 'Reset demo data', el: 'Επαναφορά δεδομένων' },
    tableView: { en: 'Table', el: 'Πίνακας' },
    chartView: { en: 'Chart', el: 'Γράφημα' },
    noData: { en: 'No data yet', el: 'Δεν υπάρχουν δεδομένα' }
  };

  var MENU_BY_ID = {};
  MENU.forEach(function (m) { MENU_BY_ID[m.id] = m; });

  global.DATA = {
    CATEGORIES: CATEGORIES,
    OPTION_GROUPS: OPTION_GROUPS,
    MENU: MENU,
    MENU_BY_ID: MENU_BY_ID,
    STRINGS: STRINGS
  };
})(typeof window !== 'undefined' ? window : globalThis);
