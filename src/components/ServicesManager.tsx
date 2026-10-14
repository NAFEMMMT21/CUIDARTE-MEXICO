import React, { useState, useEffect, useMemo } from "react";
import { ServiceItem, ServiceCategory } from "../types";
import { getCurrentTimestamp, formatCurrency } from "../utils/formatters";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Tag,
  FolderPlus,
  FolderCog,
  X,
  Check,
  Layers,
  AlertCircle,
  Upload
} from "lucide-react";
import { MassImportModal } from "./MassImportModal";

interface ServicesManagerProps {
  services: ServiceItem[];
  categories?: ServiceCategory[];
  onSaveService: (service: ServiceItem) => void;
  onBatchSaveServices?: (services: ServiceItem[]) => void;
  onDeleteService: (id: string) => void;
  onSaveCategory?: (category: ServiceCategory) => void;
  onDeleteCategory?: (id: string) => void;
}

const DEFAULT_CATEGORIES = [
  "Enfermería General",
  "Cuidado Holístico",
  "Procedimientos",
  "Acompañamiento",
  "Rehabilitación",
  "Otro",
];

export const ServicesManager: React.FC<ServicesManagerProps> = ({
  services,
  categories = [],
  onSaveService,
  onBatchSaveServices,
  onDeleteService,
  onSaveCategory,
  onDeleteCategory,
}) => {
  const [search, setSearch] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("Todos");
  const [isEditing, setIsEditing] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Category Manager Modal state
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ServiceCategory | null>(null);
  const [categoryNameInput, setCategoryNameInput] = useState("");
  const [categoryDescInput, setCategoryDescInput] = useState("");

  // Inline Quick Add Category state in Service Form
  const [isAddingInlineCategory, setIsAddingInlineCategory] = useState(false);
  const [inlineCategoryName, setInlineCategoryName] = useState("");

  // Seed default categories into Firestore on first load if no categories exist yet
  useEffect(() => {
    if (categories.length === 0 && onSaveCategory && !localStorage.getItem("cuidarte_categories_seeded_v1")) {
      localStorage.setItem("cuidarte_categories_seeded_v1", "true");
      DEFAULT_CATEGORIES.forEach((catName, idx) => {
        onSaveCategory({
          id: `CAT-DEF-${idx + 1}`,
          nombre: catName,
          descripcion: "Categoría del sistema",
          timestamp: getCurrentTimestamp(),
        });
      });
    }
  }, [categories.length, onSaveCategory]);

  const [formState, setFormState] = useState<Partial<ServiceItem>>({
    nombreServicio: "",
    categoria: "Enfermería General",
    descripcion: "",
    precio: 0,
    costo: 0,
  });

  // Calculate distinct category names from props and services
  const categoryNames = useMemo(() => {
    if (categories.length > 0) {
      const names = new Set([
        ...categories.map((c) => c.nombre),
        ...services.map((s) => s.categoria).filter(Boolean),
      ]);
      return Array.from(names).sort((a, b) => a.localeCompare(b));
    }

    // Fallback if categories array has not been populated yet
    const names = new Set([
      ...DEFAULT_CATEGORIES,
      ...services.map((s) => s.categoria).filter(Boolean),
    ]);
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [categories, services]);

  const handleOpenNewService = () => {
    setFormState({
      id: `SRV-${String(services.length + 1).padStart(3, "0")}`,
      timestamp: getCurrentTimestamp(),
      nombreServicio: "",
      categoria: categoryNames[0] || "Enfermería General",
      descripcion: "",
      precio: 0,
      costo: 0,
    });
    setIsEditing(true);
    setIsAddingInlineCategory(false);
  };

  const handleEditService = (item: ServiceItem) => {
    setFormState({ ...item });
    setIsEditing(true);
    setIsAddingInlineCategory(false);
  };

  const handleServiceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.nombreServicio) {
      alert("Ingrese el nombre del servicio");
      return;
    }

    const newItem: ServiceItem = {
      id: formState.id || `SRV-${Date.now()}`,
      timestamp: formState.timestamp || getCurrentTimestamp(),
      nombreServicio: formState.nombreServicio,
      categoria: formState.categoria || "Enfermería General",
      descripcion: formState.descripcion || "",
      precio: Number(formState.precio) || 0,
      costo: Number(formState.costo) || 0,
    };

    onSaveService(newItem);
    setIsEditing(false);
  };

  // Quick inline category save inside service form
  const handleSaveInlineCategory = () => {
    const trimmed = inlineCategoryName.trim();
    if (!trimmed) {
      alert("Ingrese un nombre válido para la categoría");
      return;
    }

    // Save as new category
    const newCatObj: ServiceCategory = {
      id: `CAT-${Date.now()}`,
      nombre: trimmed,
      descripcion: "Categoría agregada desde el formulario de servicio",
      timestamp: getCurrentTimestamp(),
    };

    if (onSaveCategory) {
      onSaveCategory(newCatObj);
    }

    // Auto select this new category in formState
    setFormState((prev) => ({ ...prev, categoria: trimmed }));
    setInlineCategoryName("");
    setIsAddingInlineCategory(false);
  };

  // Category Manager Modal actions
  const handleOpenCategoryModal = (catToEdit?: ServiceCategory) => {
    if (catToEdit) {
      setEditingCategory(catToEdit);
      setCategoryNameInput(catToEdit.nombre);
      setCategoryDescInput(catToEdit.descripcion || "");
    } else {
      setEditingCategory(null);
      setCategoryNameInput("");
      setCategoryDescInput("");
    }
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nameTrimmed = categoryNameInput.trim();
    if (!nameTrimmed) {
      alert("El nombre de la categoría no puede estar vacío.");
      return;
    }

    const oldName = editingCategory?.nombre;

    const catObj: ServiceCategory = {
      id: editingCategory ? editingCategory.id : `CAT-${Date.now()}`,
      nombre: nameTrimmed,
      descripcion: categoryDescInput.trim(),
      timestamp: editingCategory?.timestamp || getCurrentTimestamp(),
    };

    if (onSaveCategory) {
      onSaveCategory(catObj);
    }

    // If category name changed, check if existing services should be updated
    if (oldName && oldName !== nameTrimmed) {
      const affectedServices = services.filter((s) => s.categoria === oldName);
      if (affectedServices.length > 0) {
        if (
          confirm(
            `Has cambiado el nombre de "${oldName}" a "${nameTrimmed}". ¿Deseas actualizar automáticamente los ${affectedServices.length} servicio(s) que pertenecen a esta categoría?`
          )
        ) {
          affectedServices.forEach((srv) => {
            onSaveService({
              ...srv,
              categoria: nameTrimmed,
            });
          });
        }
      }
    }

    // Reset form in modal
    setEditingCategory(null);
    setCategoryNameInput("");
    setCategoryDescInput("");
  };

  const handleDeleteCategoryClick = (catName: string) => {
    const servicesInCat = services.filter((s) => s.categoria.trim().toLowerCase() === catName.trim().toLowerCase());
    if (servicesInCat.length > 0) {
      alert(
        `No se puede eliminar la categoría "${catName}" porque tiene ${servicesInCat.length} servicio(s) asociados. Reasigne o elimine esos servicios primero.`
      );
      return;
    }

    if (confirm(`¿Está seguro de eliminar la categoría "${catName}"?`)) {
      const matchObj = categories.find((c) => c.nombre.trim().toLowerCase() === catName.trim().toLowerCase());
      if (matchObj && onDeleteCategory) {
        onDeleteCategory(matchObj.id);
      } else if (onSaveCategory) {
        // If categories in Firestore was empty or missing this specific category,
        // seed all current DEFAULT_CATEGORIES except catName so Firestore holds the active set
        DEFAULT_CATEGORIES.filter((c) => c.trim().toLowerCase() !== catName.trim().toLowerCase()).forEach((cName, idx) => {
          onSaveCategory({
            id: `CAT-DEF-${idx + 1}`,
            nombre: cName,
            descripcion: "Categoría del sistema",
            timestamp: getCurrentTimestamp(),
          });
        });
        localStorage.setItem("cuidarte_categories_seeded_v1", "true");
      }
    }
  };

  const filteredServices = services.filter((s) => {
    const matchesSearch =
      s.nombreServicio.toLowerCase().includes(search.toLowerCase()) ||
      s.categoria.toLowerCase().includes(search.toLowerCase()) ||
      s.descripcion.toLowerCase().includes(search.toLowerCase());
    const matchesCategory =
      selectedCategoryFilter === "Todos" || s.categoria === selectedCategoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      {/* Top Action Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Tag className="w-5 h-5 text-sky-600" />
            Catálogo de Servicios
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Administre los servicios disponibles, categorías, precios de venta y costos de inversión por turno o procedimiento.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-slate-700 font-semibold px-4 py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-all shadow-sm"
          >
            <Upload className="w-4 h-4 text-emerald-400" />
            <span>Importar Masivo (CSV)</span>
          </button>

          <button
            onClick={() => handleOpenCategoryModal()}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-4 py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-all border border-slate-700 shadow-sm"
          >
            <FolderCog className="w-4 h-4 text-amber-400" />
            <span>Gestionar Categorías</span>
          </button>

          <button
            onClick={handleOpenNewService}
            className="bg-sky-600 hover:bg-sky-700 text-white font-semibold px-5 py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-sky-900/20"
          >
            <Plus className="w-4 h-4" />
            <span>Agregar Nuevo Servicio</span>
          </button>
        </div>
      </div>

      {/* Form Modal / Collapsible Section for Adding/Editing Service */}
      {isEditing && (
        <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl border border-slate-800 animate-fadeIn">
          <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-3">
            <h3 className="text-lg font-bold text-sky-400 flex items-center gap-2">
              <Edit2 className="w-5 h-5" />
              {formState.id ? `Editar Servicio (${formState.id})` : "Nuevo Servicio"}
            </h3>
            <span className="text-xs text-slate-400 font-mono">
              Marca Temporal: {formState.timestamp || getCurrentTimestamp()}
            </span>
          </div>

          <form onSubmit={handleServiceSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 uppercase">
                  NOMBRE DEL SERVICIO *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Turno Enfermería General 12 hrs"
                  value={formState.nombreServicio}
                  onChange={(e) =>
                    setFormState({ ...formState, nombreServicio: e.target.value })
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2 text-sm text-white focus:ring-2 focus:ring-sky-500 outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-300 uppercase">
                    CATEGORÍA *
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsAddingInlineCategory(!isAddingInlineCategory)}
                    className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 font-medium underline underline-offset-2"
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                    {isAddingInlineCategory ? "Cancelar rápida" : "+ Nueva Categoría"}
                  </button>
                </div>

                {isAddingInlineCategory ? (
                  <div className="flex items-center gap-2 bg-slate-800/90 p-1.5 rounded-lg border border-sky-500/50">
                    <input
                      type="text"
                      autoFocus
                      placeholder="Nombre de la nueva categoría..."
                      value={inlineCategoryName}
                      onChange={(e) => setInlineCategoryName(e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs text-white outline-none focus:border-sky-400"
                    />
                    <button
                      type="button"
                      onClick={handleSaveInlineCategory}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Crear</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <select
                      value={formState.categoria}
                      onChange={(e) => {
                        if (e.target.value === "__ADD_NEW__") {
                          setIsAddingInlineCategory(true);
                        } else {
                          setFormState({ ...formState, categoria: e.target.value });
                        }
                      }}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2 text-sm text-white focus:ring-2 focus:ring-sky-500 outline-none"
                    >
                      {categoryNames.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                      <option value="__ADD_NEW__" className="text-sky-400 font-bold bg-slate-900">
                        + Agregar nueva categoría...
                      </option>
                    </select>

                    <button
                      type="button"
                      onClick={() => handleOpenCategoryModal()}
                      className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 shrink-0 transition-colors"
                      title="Editar o administrar todas las categorías"
                    >
                      <FolderCog className="w-4 h-4 text-amber-400" />
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 uppercase">
                  PRECIO DE VENTA ($) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="0.00"
                    value={formState.precio || ""}
                    onChange={(e) =>
                      setFormState({ ...formState, precio: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-3 py-2 text-sm text-white focus:ring-2 focus:ring-sky-500 outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 uppercase">
                  COSTO / INVERSIÓN ($) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="0.00"
                    value={formState.costo || ""}
                    onChange={(e) =>
                      setFormState({ ...formState, costo: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-3 py-2 text-sm text-white focus:ring-2 focus:ring-sky-500 outline-none font-mono"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 uppercase">
                DESCRIPCIÓN
              </label>
              <textarea
                rows={2}
                placeholder="Detalle del servicio, horario, especificaciones o insumos incluidos..."
                value={formState.descripcion}
                onChange={(e) =>
                  setFormState({ ...formState, descripcion: e.target.value })
                }
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2 text-sm text-white focus:ring-2 focus:ring-sky-500 outline-none"
              />
            </div>

            {/* Quick Profit Margin Calc display in form */}
            <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700 flex items-center justify-between text-xs">
              <span className="text-slate-300 font-medium">Margen estimado por unidad:</span>
              <div className="flex items-center gap-4 font-mono">
                <span className="text-emerald-400 font-bold">
                  Ganancia: {formatCurrency((formState.precio || 0) - (formState.costo || 0))}
                </span>
                <span className="text-sky-300 bg-sky-950 px-2 py-0.5 rounded border border-sky-800">
                  {formState.precio ? Math.round((((formState.precio - (formState.costo || 0)) / formState.precio) * 100)) : 0}% Margen
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold rounded-lg shadow-md"
              >
                Guardar Servicio
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CATEGORIES MANAGEMENT MODAL */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-sky-50 text-sky-600 rounded-xl border border-sky-100">
                  <FolderCog className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Administrar Categorías de Servicios
                  </h3>
                  <p className="text-xs text-slate-500">
                    Cree, edite o elimine las categorías para organizar su catálogo.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsCategoryModalOpen(false);
                  setEditingCategory(null);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto p-1 space-y-6 my-4 flex-1">
              {/* Category Add / Edit Form */}
              <form onSubmit={handleSaveCategorySubmit} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    {editingCategory ? (
                      <>
                        <Edit2 className="w-3.5 h-3.5 text-amber-600" />
                        <span>Editar Categoría: "{editingCategory.nombre}"</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5 text-sky-600" />
                        <span>Agregar Nueva Categoría</span>
                      </>
                    )}
                  </h4>

                  {editingCategory && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCategory(null);
                        setCategoryNameInput("");
                        setCategoryDescInput("");
                      }}
                      className="text-xs text-slate-500 hover:text-slate-700 underline"
                    >
                      Cancelar Edición
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1 uppercase">
                      Nombre de la Categoría *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: Fisioterapia a Domicilio"
                      value={categoryNameInput}
                      onChange={(e) => setCategoryNameInput(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm text-slate-900 focus:ring-2 focus:ring-sky-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1 uppercase">
                      Descripción (Opcional)
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: Sesiones de rehabilitación física..."
                      value={categoryDescInput}
                      onChange={(e) => setCategoryDescInput(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm text-slate-900 focus:ring-2 focus:ring-sky-500 outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-lg shadow-sm flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{editingCategory ? "Guardar Cambios" : "Agregar Categoría"}</span>
                  </button>
                </div>
              </form>

              {/* List of Existing Categories */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-slate-400" />
                  <span>Categorías Registradas ({categoryNames.length})</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {categoryNames.map((catName) => {
                    const servicesInCat = services.filter((s) => s.categoria === catName);
                    const categoryObj = categories.find((c) => c.nombre === catName);

                    return (
                      <div
                        key={catName}
                        className="p-3 bg-white rounded-xl border border-slate-200 hover:border-sky-300 transition-all flex items-center justify-between gap-2 shadow-xs group"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-sm truncate">
                              {catName}
                            </span>
                            <span className="bg-slate-100 text-slate-600 font-mono text-[10px] px-2 py-0.5 rounded-full border border-slate-200 shrink-0">
                              {servicesInCat.length} servicio(s)
                            </span>
                          </div>
                          {categoryObj?.descripcion && (
                            <p className="text-xs text-slate-500 truncate mt-0.5">
                              {categoryObj.descripcion}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() =>
                              handleOpenCategoryModal(
                                categoryObj || { id: `CAT-${catName}`, nombre: catName }
                              )
                            }
                            className="p-1.5 text-slate-500 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors"
                            title="Editar Categoría"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteCategoryClick(catName)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Eliminar Categoría"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsCategoryModalOpen(false);
                  setEditingCategory(null);
                }}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, categoría o descripción..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedCategoryFilter}
            onChange={(e) => setSelectedCategoryFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500"
          >
            <option value="Todos">Todas las categorías ({services.length})</option>
            {categoryNames.map((cat) => {
              const count = services.filter((s) => s.categoria === cat).length;
              return (
                <option key={cat} value={cat}>
                  {cat} ({count})
                </option>
              );
            })}
          </select>

          <button
            onClick={() => handleOpenCategoryModal()}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200 transition-colors"
            title="Administrar Categorías"
          >
            <FolderCog className="w-4 h-4 text-sky-600" />
          </button>
        </div>
      </div>

      {/* Services Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white text-xs font-bold uppercase tracking-wider">
                <th className="py-3 px-4">Marca Temporal</th>
                <th className="py-3 px-4">Nombre del Servicio</th>
                <th className="py-3 px-4">Categoría</th>
                <th className="py-3 px-4">Descripción</th>
                <th className="py-3 px-4 text-right">Precio</th>
                <th className="py-3 px-4 text-right">Costo</th>
                <th className="py-3 px-4 text-right">Ganancia</th>
                <th className="py-3 px-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredServices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No se encontraron servicios registrados.
                  </td>
                </tr>
              ) : (
                filteredServices.map((srv) => {
                  const ganancia = srv.precio - srv.costo;
                  const margen = srv.precio > 0 ? Math.round((ganancia / srv.precio) * 100) : 0;

                  return (
                    <tr key={srv.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 text-xs font-mono text-slate-500 whitespace-nowrap">
                        {srv.timestamp || "-"}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {srv.nombreServicio}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="bg-sky-50 text-sky-700 font-semibold px-2.5 py-1 rounded-md text-xs border border-sky-100 whitespace-nowrap">
                          {srv.categoria}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 text-xs max-w-xs truncate">
                        {srv.descripcion || "-"}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(srv.precio)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-600">
                        {formatCurrency(srv.costo)}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="font-mono font-bold text-emerald-600">
                          {formatCurrency(ganancia)}
                        </div>
                        <div className="text-[10px] text-slate-400">{margen}% margen</div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleEditService(srv)}
                            className="p-1.5 text-slate-600 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors"
                            title="Editar Servicio"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`¿Eliminar servicio "${srv.nombreServicio}"?`)) {
                                onDeleteService(srv.id);
                              }
                            }}
                            className="p-1.5 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Eliminar Servicio"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mass Import Modal */}
      <MassImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        type="services"
        existingServices={services}
        existingCategories={categories}
        onImportServices={async (newServices) => {
          if (onBatchSaveServices) {
            await onBatchSaveServices(newServices);
          } else {
            for (const s of newServices) {
              await onSaveService(s);
            }
          }
        }}
      />
    </div>
  );
};
