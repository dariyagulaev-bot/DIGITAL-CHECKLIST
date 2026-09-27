import { Icon } from './Icon';
import { Bar } from './common';
import type { Category } from '../data/types';
import { shekels } from '../lib/format';

/** One monthly allowance: how much is left of the category's budget this month. */
export function AllowanceRow({ cat, spent, onClick }: { cat: Category; spent: number; onClick?: () => void }) {
  const left = cat.budget - spent;
  const over = left < 0;
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag className={'cat allowance' + (onClick ? ' clickable' : '')} onClick={onClick}>
      <span className="cat-ic"><Icon name={cat.icon} size={18} /></span>
      <div>
        <div className="cat-top">
          <span className="n">{cat.name}</span>
          {over
            ? <span className="v over">חריגה של <span className="num">{shekels(-left)}</span> ₪</span>
            : <span className="v">נשארו <b className="num">{shekels(left)}</b> ₪</span>}
        </div>
        <Bar ratio={cat.budget > 0 ? spent / cat.budget : 0} tone={over ? 'neg' : undefined} />
        <div className="allowance-sub">
          <span>הוצאו <span className="num">{shekels(spent)}</span> מתוך <span className="num">{shekels(cat.budget)}</span> ₪</span>
        </div>
      </div>
    </Tag>
  );
}
