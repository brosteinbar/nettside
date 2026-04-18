import { useEffect, useState, useCallback } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  rectSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import './Menu.css'

function EditItemForm({ item, onSave, onCancel }) {
  const [vals, setVals] = useState({
    name: item?.name ?? '',
    description: item?.description ?? '',
    allergens: item?.allergens ?? '',
    price: item?.price ?? '',
  })
  const set = (f) => (e) => setVals(v => ({ ...v, [f]: e.target.value }))

  return (
    <li className="edit-item-form">
      <input placeholder="Navn *" value={vals.name} onChange={set('name')} autoFocus />
      <input placeholder="Beskrivelse" value={vals.description} onChange={set('description')} />
      <input placeholder="Allergener (f, m, g…)" value={vals.allergens} onChange={set('allergens')} />
      <input placeholder="Pris" type="number" value={vals.price} onChange={set('price')} />
      <div className="edit-form-actions">
        <button
          onClick={() => {
            if (!vals.name.trim()) return
            onSave({ ...vals, price: vals.price === '' ? null : Number(vals.price) })
          }}
        >
          Lagre
        </button>
        <button onClick={onCancel}>Avbryt</button>
      </div>
    </li>
  )
}

function SortableMenuItem({ item, isAdmin, onEdit, onSoftDelete, onHardDelete, isDeleted }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `item-${item.id}`,
    disabled: !isAdmin || isDeleted,
  })

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className={`menu-item${isDeleted ? ' menu-item--deleted' : ''}`}
    >
      {isAdmin && !isDeleted && (
        <button className="drag-handle" {...attributes} {...listeners} tabIndex={-1}>⠿</button>
      )}
      <div className="menu-item-body">
        <div className="menu-item-row">
          <span className="menu-item-name">
            {item.name}
            {item.allergens && <span className="menu-item-allergens"> ({item.allergens})</span>}
          </span>
          {item.price != null && <span className="menu-item-price">{item.price}</span>}
        </div>
        {item.description && <div className="menu-item-desc">{item.description}</div>}
      </div>
      {isAdmin && (
        <div className="admin-item-actions">
          {isDeleted ? (
            <button className="btn-hard-delete" onClick={() => onHardDelete(item.id)} title="Slett permanent">✕</button>
          ) : (
            <>
              <button onClick={() => onEdit(item)} title="Rediger">✎</button>
              <button onClick={() => onSoftDelete(item.id)} title="Slett">×</button>
            </>
          )}
        </div>
      )}
    </li>
  )
}

function SortableCategory({
  category, isAdmin,
  editingItemId, newItemCategoryId,
  onEditItem, onSaveItem, onCancelEdit,
  onSoftDelete, onHardDelete, onAddItem,
  onCategoryNameChange, onCategoryNameBlur, onDeleteCategory,
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `cat-${category.id}`,
    disabled: !isAdmin,
  })

  const activeItems = category.items.filter(i => !i.deleted_at)
  const deletedItems = category.items.filter(i => i.deleted_at)

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className="menu-category"
    >
      <div className="menu-category-header">
        {isAdmin && (
          <button className="drag-handle cat-drag-handle" {...attributes} {...listeners} tabIndex={-1}>⠿</button>
        )}
        <span className="menu-category-dash">— </span>
        {isAdmin ? (
          <input
            className="category-name-input"
            value={category.name}
            onChange={e => onCategoryNameChange(category.id, e.target.value)}
            onBlur={() => onCategoryNameBlur(category.id, category.name)}
          />
        ) : (
          <span className="menu-category-name">{category.name}</span>
        )}
        <span className="menu-category-dash"> —</span>
        {isAdmin && (
          <button className="btn-delete-category" onClick={() => onDeleteCategory(category.id)} title="Slett kategori">×</button>
        )}
      </div>

      <SortableContext items={activeItems.map(i => `item-${i.id}`)} strategy={verticalListSortingStrategy}>
        <ul className="menu-items-list">
          {activeItems.map(item =>
            editingItemId === item.id ? (
              <EditItemForm
                key={item.id}
                item={item}
                onSave={v => onSaveItem(item.id, category.id, v)}
                onCancel={onCancelEdit}
              />
            ) : (
              <SortableMenuItem
                key={item.id}
                item={item}
                isAdmin={isAdmin}
                onEdit={onEditItem}
                onSoftDelete={onSoftDelete}
                onHardDelete={onHardDelete}
                isDeleted={false}
              />
            )
          )}
          {newItemCategoryId === category.id && (
            <EditItemForm
              item={null}
              onSave={v => onSaveItem('new', category.id, v)}
              onCancel={onCancelEdit}
            />
          )}
        </ul>
      </SortableContext>

      {isAdmin && (
        <button className="btn-add-item" onClick={() => onAddItem(category.id)}>
          + Legg til rett
        </button>
      )}

      {isAdmin && deletedItems.length > 0 && (
        <div className="deleted-items-section">
          <div className="deleted-items-label">Slettede</div>
          <ul className="menu-items-list">
            {deletedItems.map(item => (
              <SortableMenuItem
                key={item.id}
                item={item}
                isAdmin={isAdmin}
                onEdit={() => {}}
                onSoftDelete={() => {}}
                onHardDelete={onHardDelete}
                isDeleted
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export default function Menu() {
  const { user } = useAuth()
  const isAdmin = !!user

  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingItemId, setEditingItemId] = useState(null)
  const [newItemCategoryId, setNewItemCategoryId] = useState(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const fetchData = useCallback(async () => {
    const [{ data: cats }, { data: items }] = await Promise.all([
      supabase.from('menu_categories').select('*').order('sort_order'),
      supabase.from('menu_items').select('*').order('sort_order'),
    ])
    if (!cats) return
    setCategories(cats.map(c => ({ ...c, items: (items ?? []).filter(i => i.category_id === c.id) })))
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  function handleDragEnd({ active, over }) {
    if (!over || active.id === over.id) return
    const aId = String(active.id)
    const oId = String(over.id)

    if (aId.startsWith('cat-') && oId.startsWith('cat-')) {
      const from = categories.findIndex(c => `cat-${c.id}` === aId)
      const to   = categories.findIndex(c => `cat-${c.id}` === oId)
      const reordered = arrayMove(categories, from, to)
      setCategories(reordered)
      reordered.forEach((c, i) =>
        supabase.from('menu_categories').update({ sort_order: i }).eq('id', c.id)
      )
    } else if (aId.startsWith('item-') && oId.startsWith('item-')) {
      const activeId = aId.replace('item-', '')
      const overId   = oId.replace('item-', '')
      const cat = categories.find(c => c.items.some(i => i.id === activeId))
      if (!cat) return
      const from = cat.items.findIndex(i => i.id === activeId)
      const to   = cat.items.findIndex(i => i.id === overId)
      const reorderedItems = arrayMove(cat.items, from, to)
      setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, items: reorderedItems } : c))
      reorderedItems.forEach((item, i) =>
        supabase.from('menu_items').update({ sort_order: i }).eq('id', item.id)
      )
    }
  }

  async function handleSaveItem(itemId, catId, vals) {
    if (itemId === 'new') {
      const sortOrder = (categories.find(c => c.id === catId)?.items.filter(i => !i.deleted_at).length) ?? 0
      const { data } = await supabase.from('menu_items').insert({
        category_id: catId,
        name: vals.name,
        description: vals.description || null,
        allergens: vals.allergens || null,
        price: vals.price,
        sort_order: sortOrder,
      }).select().single()
      if (data) setCategories(prev => prev.map(c => c.id === catId ? { ...c, items: [...c.items, data] } : c))
    } else {
      await supabase.from('menu_items').update({
        name: vals.name,
        description: vals.description || null,
        allergens: vals.allergens || null,
        price: vals.price,
      }).eq('id', itemId)
      setCategories(prev => prev.map(c => ({
        ...c,
        items: c.items.map(i => i.id === itemId ? { ...i, ...vals } : i),
      })))
    }
    setEditingItemId(null)
    setNewItemCategoryId(null)
  }

  async function handleSoftDelete(itemId) {
    const now = new Date().toISOString()
    await supabase.from('menu_items').update({ deleted_at: now }).eq('id', itemId)
    setCategories(prev => prev.map(c => ({
      ...c,
      items: c.items.map(i => i.id === itemId ? { ...i, deleted_at: now } : i),
    })))
  }

  async function handleHardDelete(itemId) {
    await supabase.from('menu_items').delete().eq('id', itemId)
    setCategories(prev => prev.map(c => ({ ...c, items: c.items.filter(i => i.id !== itemId) })))
  }

  async function handleAddCategory() {
    const { data } = await supabase.from('menu_categories').insert({
      name: 'Ny kategori',
      sort_order: categories.length,
    }).select().single()
    if (data) setCategories(prev => [...prev, { ...data, items: [] }])
  }

  async function handleDeleteCategory(catId) {
    await supabase.from('menu_categories').delete().eq('id', catId)
    setCategories(prev => prev.filter(c => c.id !== catId))
  }

  function handleCategoryNameChange(catId, name) {
    setCategories(prev => prev.map(c => c.id === catId ? { ...c, name } : c))
  }

  async function handleCategoryNameBlur(catId, name) {
    await supabase.from('menu_categories').update({ name }).eq('id', catId)
  }

  function handleAddItem(catId) {
    setEditingItemId(null)
    setNewItemCategoryId(catId)
  }

  function handleCancelEdit() {
    setEditingItemId(null)
    setNewItemCategoryId(null)
  }

  if (loading) return <div className="menu-loading">Laster meny…</div>

  return (
    <div className="menu-page">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={categories.map(c => `cat-${c.id}`)} strategy={rectSortingStrategy}>
          <div className="menu-grid">
            {categories.map(cat => (
              <SortableCategory
                key={cat.id}
                category={cat}
                isAdmin={isAdmin}
                editingItemId={editingItemId}
                newItemCategoryId={newItemCategoryId}
                onEditItem={item => { setNewItemCategoryId(null); setEditingItemId(item.id) }}
                onSaveItem={handleSaveItem}
                onCancelEdit={handleCancelEdit}
                onSoftDelete={handleSoftDelete}
                onHardDelete={handleHardDelete}
                onAddItem={handleAddItem}
                onCategoryNameChange={handleCategoryNameChange}
                onCategoryNameBlur={handleCategoryNameBlur}
                onDeleteCategory={handleDeleteCategory}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {isAdmin && (
        <div className="admin-footer">
          <button className="btn-add-category" onClick={handleAddCategory}>
            + Legg til kategori
          </button>
        </div>
      )}
    </div>
  )
}
