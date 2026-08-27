import MenuBoard from '../components/MenuBoard'

const config = {
  categoriesTable: 'menu_categories',
  itemsTable: 'menu_items',
  menuKey: 'meny',
  pageTitle: 'Meny — Brostein',
  emptyLabel: 'Menyen er ikke klar ennå.',
  fields: [
    { key: 'description', placeholder: 'Beskrivelse', maxLength: 500 },
    { key: 'allergens',   placeholder: 'Allergener (f, m, g…)', maxLength: 500 },
  ],
  renderItemBody: (item) => (
    <>
      <div className="menu-item-row">
        <span className="menu-item-name">{item.name}</span>
        {item.price != null && <span className="menu-item-price">{item.price},-</span>}
      </div>
      {item.description && <div className="menu-item-desc">{item.description}</div>}
      {item.allergens && <div className="menu-item-allergens">{item.allergens}</div>}
    </>
  ),
}

export default function Menu() {
  return <MenuBoard config={config} />
}
