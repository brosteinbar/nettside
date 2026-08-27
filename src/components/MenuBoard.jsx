import { Fragment, useEffect, useState, useCallback, useRef, createContext, useContext } from 'react'
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
import logoRaw from '../../resources/img/Brostein_svart.svg?raw'
import '../pages/Menu.css'

const MenuAdminContext = createContext(null)
const useMenuAdmin = () => useContext(MenuAdminContext)

function useDndSensors() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
}

function EditItemForm({ item, onSave, onCancel }) {
  const { fields } = useMenuAdmin()
  const [vals, setVals] = useState(() => ({
    name: item?.name ?? '',
    price: item?.price ?? '',
    ...Object.fromEntries(fields.map(f => [f.key, item?.[f.key] ?? ''])),
  }))
  const [errors, setErrors] = useState({})
  const set = (f) => (e) => setVals(v => ({ ...v, [f]: e.target.value }))

  function handleSave() {
    const errs = {}
    if (!vals.name.trim()) errs.name = 'Navn er påkrevd'
    else if (vals.name.length > 100) errs.name = 'Maks 100 tegn'
    for (const f of fields) {
      if (vals[f.key].length > f.maxLength) errs[f.key] = `Maks ${f.maxLength} tegn`
    }
    if (vals.price !== '' && (isNaN(Number(vals.price)) || Number(vals.price) < 0))
      errs.price = 'Ugyldig pris'
    if (Object.keys(errs).length) { setErrors(errs); return }
    onSave({ ...vals, price: vals.price === '' ? null : Number(vals.price) })
  }

  return (
    <li className="edit-item-form">
      <input placeholder="Navn *" aria-label="Navn" value={vals.name} onChange={set('name')} autoFocus />
      {errors.name && <span className="form-error">{errors.name}</span>}
      {fields.map(f => (
        <Fragment key={f.key}>
          <input placeholder={f.placeholder} aria-label={f.placeholder} value={vals[f.key]} onChange={set(f.key)} />
          {errors[f.key] && <span className="form-error">{errors[f.key]}</span>}
        </Fragment>
      ))}
      <input placeholder="Pris" aria-label="Pris" type="number" value={vals.price} onChange={set('price')} />
      {errors.price && <span className="form-error">{errors.price}</span>}
      <div className="edit-form-actions">
        <button onClick={handleSave}>Lagre</button>
        <button onClick={onCancel}>Avbryt</button>
      </div>
    </li>
  )
}

function SortableMenuItem({ item, isDeleted }) {
  const { isAdmin, onEditItem, onSoftDelete, onHardDelete, onRestore, renderItemBody } = useMenuAdmin()
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
        <button className="drag-handle" {...attributes} {...listeners} aria-label="Flytt rett">⠿</button>
      )}
      <div className="menu-item-body">
        {renderItemBody(item)}
      </div>
      {isAdmin && (
        <div className="admin-item-actions">
          {isDeleted ? (
            <>
              <button className="btn-restore" onClick={() => onRestore(item.id)} title="Gjenopprett" aria-label="Gjenopprett rett">↩</button>
              <button className="btn-hard-delete" onClick={() => onHardDelete(item.id)} title="Slett permanent" aria-label="Slett rett permanent">✕</button>
            </>
          ) : (
            <>
              <button onClick={() => onEditItem(item)} title="Rediger" aria-label="Rediger rett">✎</button>
              <button onClick={() => onSoftDelete(item.id)} title="Slett" aria-label="Slett rett">×</button>
            </>
          )}
        </div>
      )}
    </li>
  )
}

function SortableCategory({ category }) {
  const {
    isAdmin, editingItemId, newItemCategoryId,
    onSaveItem, onCancelEdit, onAddItem,
    onCategoryNameChange, onCategoryNameBlur,
    onDeleteCategory, onItemsReorder,
  } = useMenuAdmin()
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
          <button className="drag-handle cat-drag-handle" {...attributes} {...listeners} aria-label="Flytt kategori">⠿</button>
        )}
        {isAdmin ? (
          <input
            className="category-name-input"
            aria-label="Kategorinavn"
            value={category.name}
            onChange={e => onCategoryNameChange(category.id, e.target.value)}
            onBlur={e => onCategoryNameBlur(category.id, e.target.value)}
          />
        ) : (
          <span className="menu-category-name">{category.name}</span>
        )}
        {isAdmin && (
          <button className="btn-delete-category" onClick={() => onDeleteCategory(category.id)} title="Slett kategori" aria-label="Slett kategori">×</button>
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
                <SortableMenuItem key={item.id} item={item} isDeleted={false} />
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
              <SortableMenuItem key={item.id} item={item} isDeleted />
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export default function MenuBoard({ config }) {
  const { categoriesTable, itemsTable, menuKey, pageTitle, fields, renderItemBody, emptyLabel } = config
  const { user } = useAuth()
  const isAdmin = !!user

  const [categories, setCategories] = useState([])
  const [visible, setVisible] = useState(true)
  const [loading, setLoading] = useState(true)
  const [editingItemId, setEditingItemId] = useState(null)
  const [newItemCategoryId, setNewItemCategoryId] = useState(null)
  const [mutationError, setMutationError] = useState(null)

  const sensors = useDndSensors()

  const reorderQueue = useRef(Promise.resolve())

  const fetchData = useCallback(async () => {
    const [catsResult, itemsResult, settingsResult] = await Promise.all([
      supabase.from(categoriesTable).select('*').order('sort_order'),
      supabase.from(itemsTable).select('*').order('sort_order'),
      supabase.from('menu_settings').select('visible').eq('menu_key', menuKey).maybeSingle(),
    ])
    if (catsResult.error || itemsResult.error) {
      setMutationError('Kunne ikke laste meny.')
      setLoading(false)
      return
    }
    const cats = catsResult.data ?? []
    const items = itemsResult.data ?? []
    setCategories(cats.map(c => ({ ...c, items: items.filter(i => i.category_id === c.id) })))
    // Fail open: a missing settings row or settings error never hides a menu.
    setVisible(settingsResult.error ? true : (settingsResult.data?.visible ?? true))
    setLoading(false)
  }, [categoriesTable, itemsTable, menuKey])

  useEffect(() => { document.title = pageTitle }, [pageTitle])
  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    document.body.classList.add('menu-page-open')
    return () => document.body.classList.remove('menu-page-open')
  }, [])

  function handleCategoryDragEnd({ active, over }) {
    if (!over || active.id === over.id) return
    const aId = String(active.id)
    const oId = String(over.id)
    if (!aId.startsWith('cat-') || !oId.startsWith('cat-')) return
    const from = categories.findIndex(c => `cat-${c.id}` === aId)
    const to   = categories.findIndex(c => `cat-${c.id}` === oId)
    const reordered = arrayMove(categories, from, to)
    setCategories(reordered)
    reorderQueue.current = reorderQueue.current.then(async () => {
      const results = await Promise.all(reordered.map((c, i) =>
        supabase.from(categoriesTable).update({ sort_order: i }).eq('id', c.id)
      ))
      if (results.some(r => r.error)) setMutationError('Kunne ikke lagre rekkefølge.')
    })
  }

  function handleItemsReorder(catId, activeId, overId) {
    const cat = categories.find(c => c.id === catId)
    if (!cat) return
    const activeItems  = cat.items.filter(i => !i.deleted_at)
    const deletedItems = cat.items.filter(i => i.deleted_at)
    const from = activeItems.findIndex(i => i.id === activeId)
    const to   = activeItems.findIndex(i => i.id === overId)
    if (from === -1 || to === -1) return
    const reordered = arrayMove(activeItems, from, to)
    setCategories(prev => prev.map(c => c.id === catId ? { ...c, items: [...reordered, ...deletedItems] } : c))
    reorderQueue.current = reorderQueue.current.then(async () => {
      const results = await Promise.all(reordered.map((item, i) =>
        supabase.from(itemsTable).update({ sort_order: i }).eq('id', item.id)
      ))
      if (results.some(r => r.error)) setMutationError('Kunne ikke lagre rekkefølge.')
    })
  }

  async function handleSaveItem(itemId, catId, vals) {
    const fieldVals = Object.fromEntries(fields.map(f => [f.key, vals[f.key] || null]))
    if (itemId === 'new') {
      const sortOrder = (categories.find(c => c.id === catId)?.items.filter(i => !i.deleted_at).length) ?? 0
      const { data, error } = await supabase.from(itemsTable).insert({
        category_id: catId,
        name: vals.name,
        ...fieldVals,
        price: vals.price,
        sort_order: sortOrder,
      }).select().single()
      if (error) { setMutationError('Kunne ikke lagre rett.'); return }
      setCategories(prev => prev.map(c => c.id === catId ? { ...c, items: [...c.items, data] } : c))
    } else {
      const { error } = await supabase.from(itemsTable).update({
        name: vals.name,
        ...fieldVals,
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
    const { error } = await supabase.from(itemsTable).update({ deleted_at: now }).eq('id', itemId)
    if (error) { setMutationError('Kunne ikke slette rett.'); return }
    setCategories(prev => prev.map(c => ({
      ...c,
      items: c.items.map(i => i.id === itemId ? { ...i, deleted_at: now } : i),
    })))
  }

  async function handleRestore(itemId) {
    const { error } = await supabase.from(itemsTable).update({ deleted_at: null }).eq('id', itemId)
    if (error) { setMutationError('Kunne ikke gjenopprette rett.'); return }
    setCategories(prev => prev.map(c => ({
      ...c,
      items: c.items.map(i => i.id === itemId ? { ...i, deleted_at: null } : i),
    })))
  }

  async function handleHardDelete(itemId) {
    const { error } = await supabase.from(itemsTable).delete().eq('id', itemId)
    if (error) { setMutationError('Kunne ikke slette rett permanent.'); return }
    setCategories(prev => prev.map(c => ({ ...c, items: c.items.filter(i => i.id !== itemId) })))
  }

  async function handleAddCategory() {
    const { data, error } = await supabase.from(categoriesTable).insert({
      name: 'Ny kategori',
      sort_order: categories.length,
    }).select().single()
    if (error) { setMutationError('Kunne ikke opprette kategori.'); return }
    setCategories(prev => [...prev, { ...data, items: [] }])
  }

  async function handleDeleteCategory(catId) {
    const { error } = await supabase.from(categoriesTable).delete().eq('id', catId)
    if (error) { setMutationError('Kunne ikke slette kategori.'); return }
    setCategories(prev => prev.filter(c => c.id !== catId))
  }

  function handleCategoryNameChange(catId, name) {
    setCategories(prev => prev.map(c => c.id === catId ? { ...c, name } : c))
  }

  async function handleCategoryNameBlur(catId, name) {
    const { error } = await supabase.from(categoriesTable).update({ name }).eq('id', catId)
    if (error) setMutationError('Kunne ikke lagre kategorinavn.')
  }

  function handleEditItem(item) {
    setNewItemCategoryId(null)
    setEditingItemId(item.id)
  }

  function handleAddItem(catId) {
    setEditingItemId(null)
    setNewItemCategoryId(catId)
  }

  function handleCancelEdit() {
    setEditingItemId(null)
    setNewItemCategoryId(null)
  }

  async function handleToggleVisibility() {
    const next = !visible
    setVisible(next)
    const { error } = await supabase.from('menu_settings').upsert({
      menu_key: menuKey,
      visible: next,
      updated_at: new Date().toISOString(),
    })
    if (error) {
      setVisible(!next)
      setMutationError('Kunne ikke endre synlighet.')
    }
  }

  if (loading) return <div className="menu-loading">Laster meny…</div>

  if (!visible && !isAdmin) {
    return (
      <div className="menu-page">
        <div className="menu-brand" aria-hidden="true">
          <div className="menu-brand-logo" dangerouslySetInnerHTML={{ __html: logoRaw }} />
        </div>
        <p className="menu-empty">{emptyLabel}</p>
      </div>
    )
  }

  const adminContext = {
    isAdmin,
    editingItemId,
    newItemCategoryId,
    fields,
    renderItemBody,
    onEditItem:            handleEditItem,
    onSaveItem:            handleSaveItem,
    onCancelEdit:          handleCancelEdit,
    onSoftDelete:          handleSoftDelete,
    onHardDelete:          handleHardDelete,
    onRestore:             handleRestore,
    onAddItem:             handleAddItem,
    onCategoryNameChange:  handleCategoryNameChange,
    onCategoryNameBlur:    handleCategoryNameBlur,
    onDeleteCategory:      handleDeleteCategory,
    onItemsReorder:        handleItemsReorder,
  }

  return (
    <MenuAdminContext.Provider value={adminContext}>
      <div className="menu-page">
        <div className="menu-brand" aria-hidden="true">
          <div className="menu-brand-logo" dangerouslySetInnerHTML={{ __html: logoRaw }} />
        </div>
        {isAdmin && (
          <div className="menu-visibility-bar">
            <span>{visible ? 'Synlig for besøkende' : 'Skjult for besøkende'}</span>
            <button onClick={handleToggleVisibility}>{visible ? 'Skjul' : 'Vis'}</button>
          </div>
        )}
        {mutationError && <p className="form-error" style={{ textAlign: 'center', padding: '0.5rem 0' }}>{mutationError}</p>}
        {categories.length === 0 && !mutationError && (
          <p className="menu-empty">{emptyLabel}</p>
        )}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleCategoryDragEnd}>
          <SortableContext items={categories.map(c => `cat-${c.id}`)} strategy={rectSortingStrategy}>
            <div className="menu-grid">
              {categories.map(cat => (
                <SortableCategory key={cat.id} category={cat} />
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
    </MenuAdminContext.Provider>
  )
}
