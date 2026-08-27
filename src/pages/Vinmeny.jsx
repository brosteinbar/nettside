import MenuBoard from '../components/MenuBoard'

const config = {
  categoriesTable: 'wine_categories',
  itemsTable: 'wine_items',
  menuKey: 'vinmeny',
  pageTitle: 'Vinmeny — Brostein',
  emptyLabel: 'Vinmenyen er ikke klar ennå.',
  fields: [
    { key: 'producer', placeholder: 'Produsent', maxLength: 500 },
    { key: 'grape',    placeholder: 'Drue', maxLength: 500 },
    { key: 'vintage',  placeholder: 'Årgang (f.eks. 2019 eller NV)', maxLength: 100 },
    { key: 'country',  placeholder: 'Land', maxLength: 500 },
    { key: 'region',   placeholder: 'Region', maxLength: 500 },
    { key: 'notes',    placeholder: 'Notater', maxLength: 500 },
  ],
  renderItemBody: (item) => (
    <>
      <div className="menu-item-row">
        <span className="menu-item-name">
          {item.name}
          {item.vintage && <span className="wine-vintage"> {item.vintage}</span>}
        </span>
        {item.price != null && <span className="menu-item-price">{item.price},-</span>}
      </div>
      {(item.producer || item.grape) && (
        <div className="menu-item-desc">{[item.producer, item.grape].filter(Boolean).join(' — ')}</div>
      )}
      {(item.region || item.country) && (
        <div className="menu-item-desc">{[item.region, item.country].filter(Boolean).join(', ')}</div>
      )}
      {item.notes && <div className="menu-item-allergens">{item.notes}</div>}
    </>
  ),
}

export default function Vinmeny() {
  return <MenuBoard config={config} />
}
