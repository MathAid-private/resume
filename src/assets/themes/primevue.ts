import type { AuraBaseDesignTokens, AuraBaseTokenSections } from '@primeuix/themes/aura/base'
import type { LaraBaseDesignTokens, LaraBaseTokenSections } from '@primeuix/themes/lara/base'
import type {
  MaterialBaseDesignTokens,
  MaterialBaseTokenSections,
} from '@primeuix/themes/material/base'
import type { NoraBaseDesignTokens, NoraBaseTokenSections } from '@primeuix/themes/nora/base'
import type { ComponentsDesignTokens, PaletteDesignToken } from '@primeuix/themes/types'
import type { AccordionDesignTokens } from "@primeuix/themes/types/accordion"
import type { AutoCompleteDesignTokens } from '@primeuix/themes/types/autocomplete'
import type { AvatarDesignTokens } from "@primeuix/themes/types/avatar"
import type { BadgeDesignTokens } from "@primeuix/themes/types/badge"
import type { ButtonDesignTokens } from "@primeuix/themes/types/button"
import type { CardDesignTokens } from "@primeuix/themes/types/card"
import type { CarouselDesignTokens } from "@primeuix/themes/types/carousel"
import type { ConfirmDialogDesignTokens } from "@primeuix/themes/types/confirmdialog"
import type { ConfirmPopupDesignTokens } from "@primeuix/themes/types/confirmpopup"
import type { DataTableDesignTokens } from "@primeuix/themes/types/datatable"
import type { DatePickerDesignTokens } from "@primeuix/themes/types/datepicker"
import type { DialogDesignTokens } from "@primeuix/themes/types/dialog"
import type { DividerDesignTokens } from "@primeuix/themes/types/divider"
import type { DrawerDesignTokens } from "@primeuix/themes/types/drawer"
import type { FileUploadDesignTokens } from "@primeuix/themes/types/fileupload"
import type { IconFieldDesignTokens } from "@primeuix/themes/types/iconfield"
import type { InputGroupDesignTokens } from "@primeuix/themes/types/inputgroup"
import type { InputTextDesignTokens } from "@primeuix/themes/types/inputtext"
import type { MegaMenuDesignTokens } from "@primeuix/themes/types/megamenu"
import type { MenuDesignTokens } from "@primeuix/themes/types/menu"
import type { MenubarDesignTokens } from "@primeuix/themes/types/menubar"
import type { MultiSelectDesignTokens } from "@primeuix/themes/types/multiselect"
import type { PanelDesignTokens } from "@primeuix/themes/types/panel"
import type { PasswordDesignTokens } from "@primeuix/themes/types/password"
import type { PopoverDesignTokens } from "@primeuix/themes/types/popover"
import type { ProgressBarDesignTokens } from "@primeuix/themes/types/progressbar"
import type { ProgressSpinnerDesignTokens } from "@primeuix/themes/types/progressspinner"
import type { RadioButtonDesignTokens } from "@primeuix/themes/types/radiobutton"
import type { ScrollPanelDesignTokens } from "@primeuix/themes/types/scrollpanel"
import type { SelectDesignTokens } from "@primeuix/themes/types/select"
import type { SelectButtonDesignTokens } from "@primeuix/themes/types/selectbutton"
import type { SkeletonDesignTokens } from "@primeuix/themes/types/skeleton"
import type { SliderDesignTokens } from "@primeuix/themes/types/slider"
import type { SplitterDesignTokens } from "@primeuix/themes/types/splitter"
import type { StepperDesignTokens } from "@primeuix/themes/types/stepper"
import type { TabsDesignTokens } from "@primeuix/themes/types/tabs"
import type { TagDesignTokens } from "@primeuix/themes/types/tag"
import type { TextareaDesignTokens } from "@primeuix/themes/types/textarea"
import type { TimelineDesignTokens } from "@primeuix/themes/types/timeline"
import type { ToggleButtonDesignTokens } from "@primeuix/themes/types/togglebutton"
import type { ToggleSwitchDesignTokens } from "@primeuix/themes/types/toggleswitch"
import type { TooltipDesignTokens } from "@primeuix/themes/types/tooltip"

export interface PrimeComponentDesignTokens {
  accordion: AccordionDesignTokens
  autocomplete: AutoCompleteDesignTokens
  avatar: AvatarDesignTokens
  button: ButtonDesignTokens
  badge: BadgeDesignTokens
  card: CardDesignTokens
  carousel: CarouselDesignTokens
  confirmdialog: ConfirmDialogDesignTokens
  confirmpopup: ConfirmPopupDesignTokens
  dialog: DialogDesignTokens
  datatable: DataTableDesignTokens
  datepicker: DatePickerDesignTokens
  drawer: DrawerDesignTokens
  divider: DividerDesignTokens
  fileupload: FileUploadDesignTokens
  iconfield: IconFieldDesignTokens
  inputgroup: InputGroupDesignTokens
  inputtext: InputTextDesignTokens
  menu: MenuDesignTokens
  menubar: MenubarDesignTokens
  megamenu: MegaMenuDesignTokens
  multiselect: MultiSelectDesignTokens
  panel: PanelDesignTokens
  password: PasswordDesignTokens
  popover: PopoverDesignTokens
  progressbar: ProgressBarDesignTokens
  progressspinner: ProgressSpinnerDesignTokens
  radiobutton: RadioButtonDesignTokens
  scrollpanel: ScrollPanelDesignTokens
  select: SelectDesignTokens
  selectbutton: SelectButtonDesignTokens
  slider: SliderDesignTokens
  splitter: SplitterDesignTokens
  skeleton: SkeletonDesignTokens
  stepper: StepperDesignTokens
  tabs: TabsDesignTokens
  tag: TagDesignTokens
  textarea: TextareaDesignTokens
  timeline: TimelineDesignTokens
  togglebutton: ToggleButtonDesignTokens
  toggleswitch: ToggleSwitchDesignTokens
  tooltip: TooltipDesignTokens
}

export type PrimeColor = {
  50?: string
  100?: string
  200?: string
  300?: string
  400?: string
  500?: string
  600?: string
  700?: string
  800?: string
  900?: string
  950?: string
}

export type PrimePrimaryControl = {
  color: string
  contrastColor: string
  hoverColor: string
  activeColor: string
  mutedColor: string
  hoverMutedColor: string
}
export type PrimeColorScheme = {
  surface: PaletteDesignToken
  primary: Partial<Omit<PrimePrimaryControl, 'mutedColor' | 'hoverMutedColor'>>
  text: Partial<Omit<PrimePrimaryControl, 'contrastColor' | 'activeColor'>>
  highlight: {
    background?: string
    focusBackground?: string
    color?: string
    focusColor?: string
  }
  mask: {
    background?: string
    color?: string
  }
  formField?: {
    background?: string
    disabledBackground?: string
    filledBackground?: string
    filledHoverBackground?: string
    filledFocusBackground?: string
    borderColor?: string
    hoverBorderColor?: string
    focusBorderColor?: string
    invalidBorderColor?: string
    color?: string
    disabledColor?: string
    placeholderColor?: string
    invalidPlaceholderColor?: string
    floatLabelColor?: string
    floatLabelFocusColor?: string
    floatLabelActiveColor?: string
    floatLabelInvalidColor?: string
    iconColor?: string
    shadow?: string
  }
  content?: {
    background?: string
    hoverBackground?: string
    borderColor?: string
    color?: string
    hoverColor?: string
  }
  overlay?: {
    select?: {
      background?: string
      borderColor?: string
      color?: string
    }
    popover?: {
      background?: string
      borderColor?: string
      color?: string
    }
    modal?: {
      background?: string
      borderColor?: string
      color?: string
    }
  }
  list?: {
    option?: {
      focusBackground?: string
      selectedBackground?: string
      selectedFocusBackground?: string
      color?: string
      focusColor?: string
      selectedColor?: string
      selectedFocusColor?: string
      icon?: {
        color?: string
        focusColor?: string
      }
    }
    optionGroup?: {
      background?: string
      color?: string
    }
  }
  navigation?: {
    item?: {
      focusBackground?: string
      activeBackground?: string
      color?: string
      focusColor?: string
      activeColor?: string
      icon?: {
        color?: string
        focusColor?: string
        activeColor?: string
      }
    }
    submenuLabel?: {
      background?: string
      color?: string
    }
    submenuIcon?: {
      color?: string
      focusColor?: string
      activeColor?: string
    }
  }
}
export type AuraSemanticColorScheme = AuraBaseTokenSections.Semantic['colorScheme']
export type PrimeLight = Partial<PrimeColorScheme>
export type PrimeDark = Partial<PrimeColorScheme>

const accordion: ComponentsDesignTokens['accordion'] = {}
const autocomplete: ComponentsDesignTokens['autocomplete'] = {}
const avatar: ComponentsDesignTokens['avatar'] = {}
const button: ComponentsDesignTokens['button'] = {}
const badge: ComponentsDesignTokens['badge'] = {}
const card: ComponentsDesignTokens['card'] = {}
const carousel: ComponentsDesignTokens['carousel'] = {}
const confirmdialog: ComponentsDesignTokens['confirmdialog'] = {}
const confirmpopup: ComponentsDesignTokens['confirmpopup'] = {}
const dialog: ComponentsDesignTokens['dialog'] = {}
const datatable: ComponentsDesignTokens['datatable'] = {}
const datepicker: ComponentsDesignTokens['datepicker'] = {}
const drawer: ComponentsDesignTokens['drawer'] = {}
const divider: ComponentsDesignTokens['divider'] = {}
const fileupload: ComponentsDesignTokens['fileupload'] = {}
const iconfield: ComponentsDesignTokens['iconfield'] = {}
const inputgroup: ComponentsDesignTokens['inputgroup'] = {}
const inputtext: ComponentsDesignTokens['inputtext'] = {}
const menu: ComponentsDesignTokens['menu'] = {}
const menubar: ComponentsDesignTokens['menubar'] = {}
const megamenu: ComponentsDesignTokens['megamenu'] = {}
const multiselect: ComponentsDesignTokens['multiselect'] = {}
const panel: ComponentsDesignTokens['panel'] = {}
const password: ComponentsDesignTokens['password'] = {}
const popover: ComponentsDesignTokens['popover'] = {}
const progressbar: ComponentsDesignTokens['progressbar'] = {}
const progressspinner: ComponentsDesignTokens['progressspinner'] = {}
const radiobutton: ComponentsDesignTokens['radiobutton'] = {}
const scrollpanel: ComponentsDesignTokens['scrollpanel'] = {}
const select: ComponentsDesignTokens['select'] = {}
const selectbutton: ComponentsDesignTokens['selectbutton'] = {}
const slider: ComponentsDesignTokens['slider'] = {}
const splitter: ComponentsDesignTokens['splitter'] = {}
const skeleton: ComponentsDesignTokens['skeleton'] = {}
const stepper: ComponentsDesignTokens['stepper'] = {}
const tabs: ComponentsDesignTokens['tabs'] = {}
const tag: ComponentsDesignTokens['tag'] = {}
const textarea: ComponentsDesignTokens['textarea'] = {}
const timeline: ComponentsDesignTokens['timeline'] = {}
const togglebutton: ComponentsDesignTokens['togglebutton'] = {}
const toggleswitch: ComponentsDesignTokens['toggleswitch'] = {}
const tooltip: ComponentsDesignTokens['tooltip'] = {}
const blockui: ComponentsDesignTokens['blockui'] = {}
const breadcrumb: ComponentsDesignTokens['breadcrumb'] = {}
const cascadeselect: ComponentsDesignTokens['cascadeselect'] = {}
const checkbox: ComponentsDesignTokens['checkbox'] = {}
const chip: ComponentsDesignTokens['chip'] = {}
const colorpicker: ComponentsDesignTokens['colorpicker'] = {}
const contextmenu: ComponentsDesignTokens['contextmenu'] = {}
const dataview: ComponentsDesignTokens['dataview'] = {}
const dock: ComponentsDesignTokens['dock'] = {}
const editor: ComponentsDesignTokens['editor'] = {}
const fieldset: ComponentsDesignTokens['fieldset'] = {}
const floatlabel: ComponentsDesignTokens['floatlabel'] = {}
const galleria: ComponentsDesignTokens['galleria'] = {}
const iftalabel: ComponentsDesignTokens['iftalabel'] = {}
const image: ComponentsDesignTokens['image'] = {}
const imagecompare: ComponentsDesignTokens['imagecompare'] = {}
const inlinemessage: ComponentsDesignTokens['inlinemessage'] = {}
const inplace: ComponentsDesignTokens['inplace'] = {}
const inputchips: ComponentsDesignTokens['inputchips'] = {}
const inputnumber: ComponentsDesignTokens['inputnumber'] = {}
const inputotp: ComponentsDesignTokens['inputotp'] = {}
const knob: ComponentsDesignTokens['knob'] = {}
const listbox: ComponentsDesignTokens['listbox'] = {}
const message: ComponentsDesignTokens['message'] = {}
const metergroup: ComponentsDesignTokens['metergroup'] = {}
const orderlist: ComponentsDesignTokens['orderlist'] = {}
const organizationchart: ComponentsDesignTokens['organizationchart'] = {}
const overlaybadge: ComponentsDesignTokens['overlaybadge'] = {}
const paginator: ComponentsDesignTokens['paginator'] = {}
const panelmenu: ComponentsDesignTokens['panelmenu'] = {}
const picklist: ComponentsDesignTokens['picklist'] = {}
const rating: ComponentsDesignTokens['rating'] = {}
const ripple: ComponentsDesignTokens['ripple'] = {}
const speeddial: ComponentsDesignTokens['speeddial'] = {}
const splitbutton: ComponentsDesignTokens['splitbutton'] = {}
const steps: ComponentsDesignTokens['steps'] = {}
const tabmenu: ComponentsDesignTokens['tabmenu'] = {}
const tabview: ComponentsDesignTokens['tabview'] = {}
const terminal: ComponentsDesignTokens['terminal'] = {}
const tieredmenu: ComponentsDesignTokens['tieredmenu'] = {}
const toast: ComponentsDesignTokens['toast'] = {}
const toolbar: ComponentsDesignTokens['toolbar'] = {}
const tree: ComponentsDesignTokens['tree'] = {}
const treeselect: ComponentsDesignTokens['treeselect'] = {}
const treetable: ComponentsDesignTokens['treetable'] = {}
const virtualscroller: ComponentsDesignTokens['virtualscroller'] = {}

const components = {
  accordion,
  autocomplete,
  avatar,
  button,
  badge,
  blockui,
  breadcrumb,
  dataview,
  dock,
  editor,
  fieldset,
  floatlabel,
  galleria,
  iftalabel,
  image,
  imagecompare,
  inlinemessage,
  inplace,
  inputchips,
  inputnumber,
  inputotp,
  knob,
  listbox,
  message,
  metergroup,
  orderlist,
  organizationchart,
  overlaybadge,
  paginator,
  panelmenu,
  picklist,
  rating,
  ripple,
  speeddial,
  splitbutton,
  steps,
  tabmenu,
  tabview,
  terminal,
  tieredmenu,
  toast,
  toolbar,
  tree,
  treeselect,
  treetable,
  virtualscroller,
  cascadeselect,
  checkbox,
  chip,
  colorpicker,
  contextmenu,
  card,
  carousel,
  confirmdialog,
  confirmpopup,
  dialog,
  datatable,
  datepicker,
  drawer,
  divider,
  fileupload,
  iconfield,
  inputgroup,
  inputtext,
  menu,
  menubar,
  megamenu,
  multiselect,
  panel,
  password,
  popover,
  progressbar,
  progressspinner,
  radiobutton,
  scrollpanel,
  select,
  selectbutton,
  slider,
  splitter,
  skeleton,
  stepper,
  tabs,
  tag,
  textarea,
  timeline,
  togglebutton,
  toggleswitch,
  tooltip,
} as Required<ComponentsDesignTokens>
const light: PrimeLight = {
  primary: {
    color: 'var(--color-primary)',
    contrastColor: 'var(--color-accent)',
    hoverColor: 'color-mix(in oklab, var(--color-primary) 80%, transparent)',
    activeColor: 'color-mix(in oklab, var(--color-primary) 70%, transparent)',
  },
  highlight: {
    background: 'color-mix(in oklab, var(--color-primary) 50%, transparent)',
    focusBackground: 'color-mix(in oklab, var(--color-primary) 80%, white)',
    color: 'var(--color-glyph)',
    focusColor: 'var(--color-glyph)',
  },
  mask: {
    background: 'color-mix(in oklab, var(--color-background) 80%, transparent)',
    color: 'var(--color-glyph)',
  },
  formField: {
    background: 'var(--color-surface)',
    borderColor: 'color-mix(in oklab, var(--color-glyph) 60%, transparent)',
    color: 'var(--color-glyph)',
    hoverBorderColor: 'color-mix(in oklab, var(--color-primary) 70%, transparent)',
    disabledBackground: 'color-mix(in oklab, var(--color-surface) 5%, transparent)',
    disabledColor: 'color-mix(in oklab, var(--color-glyph) 20%, transparent)',
    filledBackground: 'color-mix(in oklab, var(--color-primary) 15%, transparent)',
    filledHoverBackground: 'color-mix(in oklab, var(--color-primary) 20%, transparent)',
    filledFocusBackground: 'color-mix(in oklab, var(--color-primary) 25%, transparent)',
    focusBorderColor: 'color-mix(in oklab, var(--color-primary) 80%, transparent)',
    invalidBorderColor: 'var(--color-error)',
    iconColor: 'color-mix(in oklab, var(--color-glyph) 60%, transparent)',
    placeholderColor: 'color-mix(in oklab, var(--color-glyph) 50%, transparent)',
    invalidPlaceholderColor: 'color-mix(in oklab, var(--color-glyph) 50%, transparent)',
    shadow: 'color-mix(in oklab, var(--color-glyph) 5%, transparent)',
  },
  text: {
    color: 'var(--color-glyph)',
    hoverColor: 'color-mix(in oklab, var(--color-glyph) 90%, transparent)',
    mutedColor: 'color-mix(in oklab, var(--color-glyph) 50%, transparent)',
    hoverMutedColor: 'color-mix(in oklab, var(--color-glyph) 40%, transparent)',
  },
  content: {
    background: 'var(--color-surface)',
    borderColor: 'color-mix(in oklab, var(--color-glyph) 60%, transparent)',
    color: 'color-mix(in oklab, var(--color-glyph) 90%, transparent)',
    hoverBackground: 'color-mix(in oklab, var(--color-surface) 70%, transparent)',
    hoverColor: 'color-mix(in oklab, var(--color-glyph) 80%, transparent)',
  },
  navigation: {
    item: {
      focusBackground: 'color-mix(in oklab, var(--color-primary) 15%, transparent)',
      activeBackground: 'color-mix(in oklab, var(--color-primary) 25%, transparent)',
      color: 'color-mix(in oklab, var(--color-glyph) 85%, transparent)',
      focusColor: 'color-mix(in oklab, var(--color-glyph) 90%, transparent)',
      activeColor: 'color-mix(in oklab, var(--color-glyph) 95%, transparent)',
      icon: {
        color: 'color-mix(in oklab, var(--color-glyph) 60%, transparent)',
        focusColor: 'color-mix(in oklab, var(--color-glyph) 70%, transparent)',
        activeColor: 'color-mix(in oklab, var(--color-glyph) 75%, transparent)'
      },
    }
  },
  list: {
    option: {
      color: 'color-mix(in oklab, var(--color-glyph) 85%, transparent)',
      focusColor: 'color-mix(in oklab, var(--color-glyph) 90%, transparent)',
      selectedColor: 'color-mix(in oklab, var(--color-glyph) 95%, transparent)',
      selectedFocusColor: 'var(--color-glyph)',
      focusBackground: 'color-mix(in oklab, var(--color-primary) 15%, transparent)',
      selectedBackground: 'color-mix(in oklab, var(--color-primary) 25%, transparent)',
      selectedFocusBackground: 'color-mix(in oklab, var(--color-primary) 30%, transparent)',
    },
  },
  overlay: {
    modal: {
      background: 'var(--color-surface)',
      borderColor: 'color-mix(in oklab, var(--color-glyph) 60%, transparent)',
      color: 'var(--color-glyph)',
    },
    popover: {
      background: 'var(--color-surface)',
      borderColor: 'color-mix(in oklab, var(--color-glyph) 60%, transparent)',
      color: 'var(--color-glyph)',
    },
    select: {
      background: 'var(--color-surface)',
      borderColor: 'color-mix(in oklab, var(--color-glyph) 60%, transparent)',
      color: 'var(--color-glyph)',
    },
  },
}
const dark: PrimeDark = light
const colorScheme: AuraSemanticColorScheme = {
  dark,
  light,
}

const auraPrimitive: AuraBaseDesignTokens['primitive'] = {}
const auraSemantic: AuraBaseDesignTokens['semantic'] = {
  colorScheme,
}
const auraDesignToken: AuraBaseDesignTokens & { components: PrimeComponentDesignTokens } = {
  components,
  primitive: auraPrimitive,
  semantic: auraSemantic,
}

export type LaraSemanticColorScheme = LaraBaseTokenSections.Semantic['colorScheme']

const laraPrimitive: LaraBaseDesignTokens['primitive'] = {}
const laraSemantic: LaraBaseDesignTokens['semantic'] = {
  colorScheme,
}
const laraDesignToken: LaraBaseDesignTokens & { components: PrimeComponentDesignTokens } = {
  components,
  primitive: laraPrimitive,
  semantic: laraSemantic,
}

export type NoraSemanticColorScheme = NoraBaseTokenSections.Semantic['colorScheme']

const noraPrimitive: NoraBaseDesignTokens['primitive'] = {}
const noraSemantic: NoraBaseDesignTokens['semantic'] = {
  colorScheme,
}
const noraDesignToken: NoraBaseDesignTokens & { components: PrimeComponentDesignTokens } = {
  components,
  primitive: noraPrimitive,
  semantic: noraSemantic,
}

export type MaterialSemanticColorScheme = MaterialBaseTokenSections.Semantic['colorScheme']

const materialPrimitive: MaterialBaseDesignTokens['primitive'] = {}
const materialSemantic: MaterialBaseDesignTokens['semantic'] = {
  colorScheme,
}
const materialDesignToken: MaterialBaseDesignTokens & { components: PrimeComponentDesignTokens } = {
  components,
  primitive: materialPrimitive,
  semantic: materialSemantic,
}

export {
  auraDesignToken as aura,
  laraDesignToken as lara, materialDesignToken as material, noraDesignToken as nora
}

