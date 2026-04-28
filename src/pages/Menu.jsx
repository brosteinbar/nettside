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

function useDndSensors() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
}

function EditItemForm({ item, onSave, onCancel }) {
  const [vals, setVals] = useState({
    name: item?.name ?? '',
    description: item?.description ?? '',
    allergens: item?.allergens ?? '',
    price: item?.price ?? '',
  })
  const [errors, setErrors] = useState({})
  const set = (f) => (e) => setVals(v => ({ ...v, [f]: e.target.value }))

  function handleSave() {
    const errs = {}
    if (!vals.name.trim()) errs.name = 'Navn er påkrevd'
    else if (vals.name.length > 100) errs.name = 'Maks 100 tegn'
    if (vals.description.length > 500) errs.description = 'Maks 500 tegn'
    if (vals.allergens.length > 500) errs.allergens = 'Maks 500 tegn'
    if (vals.price !== '' && (isNaN(Number(vals.price)) || Number(vals.price) < 0))
      errs.price = 'Ugyldig pris'
    if (Object.keys(errs).length) { setErrors(errs); return }
    onSave({ ...vals, price: vals.price === '' ? null : Number(vals.price) })
  }

  return (
    <li className="edit-item-form">
      <input placeholder="Navn *" value={vals.name} onChange={set('name')} autoFocus />
      {errors.name && <span style={{ color: '#b94040', fontSize: '0.8rem' }}>{errors.name}</span>}
      <input placeholder="Beskrivelse" value={vals.description} onChange={set('description')} />
      {errors.description && <span style={{ color: '#b94040', fontSize: '0.8rem' }}>{errors.description}</span>}
      <input placeholder="Allergener (f, m, g…)" value={vals.allergens} onChange={set('allergens')} />
      {errors.allergens && <span style={{ color: '#b94040', fontSize: '0.8rem' }}>{errors.allergens}</span>}
      <input placeholder="Pris" type="number" value={vals.price} onChange={set('price')} />
      {errors.price && <span style={{ color: '#b94040', fontSize: '0.8rem' }}>{errors.price}</span>}
      <div className="edit-form-actions">
        <button onClick={handleSave}>Lagre</button>
        <button onClick={onCancel}>Avbryt</button>
      </div>
    </li>
  )
}

function SortableMenuItem({ item, isAdmin, onEdit, onSoftDelete, onHardDelete, onRestore, isDeleted }) {
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
            <>
              <button className="btn-restore" onClick={() => onRestore(item.id)} title="Gjenopprett">↩</button>
              <button className="btn-hard-delete" onClick={() => onHardDelete(item.id)} title="Slett permanent">✕</button>
            </>
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
  onSoftDelete, onHardDelete, onRestore, onAddItem,
  onCategoryNameChange, onCategoryNameBlur, onDeleteCategory,
  onItemsReorder,
}) {
  const sensors = useDndSensors()

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `cat-${category.id}`,
    disabled: !isAdmin,
  })

  const activeItems  = category.items.filter(i => !i.deleted_at)
  const deletedItems = category.items.filter(i => i.deleted_at)

  function handleItemDragEnd({ active, over }) {
    if (!over || active.id === over.id) return
    const activeId = String(active.id).replace('item-', '')
    const overId   = String(over.id).replace('item-', '')
    onItemsReorder(category.id, activeId, overId)
  }

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

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleItemDragEnd}>
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
                  onRestore={onRestore}
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
      </DndContext>

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
                onRestore={onRestore}
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
  const [mutationError, setMutationError] = useState(null)

  const sensors = useDndSensors()

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

  async function handleCategoryDragEnd({ active, over }) {
    if (!over || active.id === over.id) return
    const aId = String(active.id)
    const oId = String(over.id)
    if (!aId.startsWith('cat-') || !oId.startsWith('cat-')) return
    const from = categories.findIndex(c => `cat-${c.id}` === aId)
    const to   = categories.findIndex(c => `cat-${c.id}` === oId)
    const reordered = arrayMove(categories, from, to)
    setCategories(reordered)
    const results = await Promise.all(reordered.map((c, i) =>
      supabase.from('menu_categories').update({ sort_order: i }).eq('id', c.id)
    ))
    if (results.some(r => r.error)) setMutationError('Kunne ikke lagre rekkefølge.')
  }

  async function handleItemsReorder(catId, activeId, overId) {
    const cat = categories.find(c => c.id === catId)
    if (!cat) return
    const activeItems  = cat.items.filter(i => !i.deleted_at)
    const deletedItems = cat.items.filter(i => i.deleted_at)
    const from = activeItems.findIndex(i => i.id === activeId)
    const to   = activeItems.findIndex(i => i.id === overId)
    if (from === -1 || to === -1) return
    const reordered = arrayMove(activeItems, from, to)
    setCategories(prev => prev.map(c => c.id === catId ? { ...c, items: [...reordered, ...deletedItems] } : c))
    const results = await Promise.all(reordered.map((item, i) =>
      supabase.from('menu_items').update({ sort_order: i }).eq('id', item.id)
    ))
    if (results.some(r => r.error)) setMutationError('Kunne ikke lagre rekkefølge.')
  }

  async function handleSaveItem(itemId, catId, vals) {
    if (itemId === 'new') {
      const sortOrder = (categories.find(c => c.id === catId)?.items.filter(i => !i.deleted_at).length) ?? 0
      const { data, error } = await supabase.from('menu_items').insert({
        category_id: catId,
        name: vals.name,
        description: vals.description || null,
        allergens: vals.allergens || null,
        price: vals.price,
        sort_order: sortOrder,
      }).select().single()
      if (error) { setMutationError('Kunne ikke lagre rett.'); return }
      setCategories(prev => prev.map(c => c.id === catId ? { ...c, items: [...c.items, data] } : c))
    } else {
      const { error } = await supabase.from('menu_items').update({
        name: vals.name,
        description: vals.description || null,
        allergens: vals.allergens || null,
        price: vals.price,
      }).eq('id', itemId)
      if (error) { setMutationError('Kunne ikke oppdatere rett.'); return }
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
    const { error } = await supabase.from('menu_items').update({ deleted_at: now }).eq('id', itemId)
    if (error) { setMutationError('Kunne ikke slette rett.'); return }
    setCategories(prev => prev.map(c => ({
      ...c,
      items: c.items.map(i => i.id === itemId ? { ...i, deleted_at: now } : i),
    })))
  }

  async function handleRestore(itemId) {
    const { error } = await supabase.from('menu_items').update({ deleted_at: null }).eq('id', itemId)
    if (error) { setMutationError('Kunne ikke gjenopprette rett.'); return }
    setCategories(prev => prev.map(c => ({
      ...c,
      items: c.items.map(i => i.id === itemId ? { ...i, deleted_at: null } : i),
    })))
  }

  async function handleHardDelete(itemId) {
    const { error } = await supabase.from('menu_items').delete().eq('id', itemId)
    if (error) { setMutationError('Kunne ikke slette rett permanent.'); return }
    setCategories(prev => prev.map(c => ({ ...c, items: c.items.filter(i => i.id !== itemId) })))
  }

  async function handleAddCategory() {
    const { data, error } = await supabase.from('menu_categories').insert({
      name: 'Ny kategori',
      sort_order: categories.length,
    }).select().single()
    if (error) { setMutationError('Kunne ikke opprette kategori.'); return }
    setCategories(prev => [...prev, { ...data, items: [] }])
  }

  async function handleDeleteCategory(catId) {
    const { error } = await supabase.from('menu_categories').delete().eq('id', catId)
    if (error) { setMutationError('Kunne ikke slette kategori.'); return }
    setCategories(prev => prev.filter(c => c.id !== catId))
  }

  function handleCategoryNameChange(catId, name) {
    setCategories(prev => prev.map(c => c.id === catId ? { ...c, name } : c))
  }

  async function handleCategoryNameBlur(catId, name) {
    const { error } = await supabase.from('menu_categories').update({ name }).eq('id', catId)
    if (error) setMutationError('Kunne ikke lagre kategorinavn.')
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
      {mutationError && (
        <p style={{ color: '#b94040', textAlign: 'center', padding: '0.5rem 0' }}>{mutationError}</p>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleCategoryDragEnd}>
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
                onRestore={handleRestore}
                onAddItem={handleAddItem}
                onCategoryNameChange={handleCategoryNameChange}
                onCategoryNameBlur={handleCategoryNameBlur}
                onDeleteCategory={handleDeleteCategory}
                onItemsReorder={handleItemsReorder}
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
