-- Shared reference data (user_id null). Lives in a migration, not seed.sql, so production gets it too.
-- email_domains stay empty until each sender is confirmed from a real (redacted) fixture:
-- an empty allowlist means "store but flag", which is the safe failure.

insert into public.institutions (user_id, slug, name, kind) values
  (null, 'gcash',          'GCash',          'ewallet'),
  (null, 'maya',           'Maya',           'ewallet'),
  (null, 'bpi',            'BPI',            'bank'),
  (null, 'bdo',            'BDO',            'bank'),
  (null, 'eastwest',       'EastWest',       'bank'),
  (null, 'atome',          'Atome',          'bnpl'),
  (null, 'metrobank',      'Metrobank',      'bank'),
  (null, 'unionbank',      'UnionBank',      'bank'),
  (null, 'security-bank',  'Security Bank',  'bank'),
  (null, 'rcbc',           'RCBC',           'bank'),
  (null, 'pnb',            'PNB',            'bank'),
  (null, 'landbank',       'Landbank',       'bank'),
  (null, 'china-bank',     'China Bank',     'bank'),
  (null, 'psbank',         'PSBank',         'bank'),
  (null, 'gotyme',         'GoTyme',         'bank'),
  (null, 'seabank',        'SeaBank',        'bank'),
  (null, 'tonik',          'Tonik',          'bank'),
  (null, 'shopeepay',      'ShopeePay',      'ewallet'),
  (null, 'spaylater',      'SPayLater',      'bnpl'),
  (null, 'cash',           'Cash',           'other');

-- icon = Lucide icon name
insert into public.categories (user_id, name, kind, icon) values
  (null, 'Food',                 'expense',  'utensils'),
  (null, 'Groceries',            'expense',  'shopping-basket'),
  (null, 'Transport',            'expense',  'car'),
  (null, 'Bills',                'expense',  'zap'),
  (null, 'Rent',                 'expense',  'house'),
  (null, 'Load & subscriptions', 'expense',  'smartphone'),
  (null, 'Shopping',             'expense',  'shopping-bag'),
  (null, 'Health',               'expense',  'heart-pulse'),
  (null, 'Education',            'expense',  'graduation-cap'),
  (null, 'Entertainment',        'expense',  'clapperboard'),
  (null, 'Family & gifts',       'expense',  'gift'),
  (null, 'Fees & interest',      'expense',  'receipt'),
  (null, 'Other',                'expense',  'circle-dashed'),
  (null, 'Salary',               'income',   'briefcase'),
  (null, 'Allowance',            'income',   'hand-coins'),
  (null, 'Other income',         'income',   'arrow-down-left'),
  (null, 'Transfer',             'transfer', 'arrow-left-right'),
  (null, 'Card payment',         'transfer', 'credit-card');
