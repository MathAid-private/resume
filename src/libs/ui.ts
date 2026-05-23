import { compile, type VNode } from "vue"

/**
 * Defines a light weight inline component that does not
 * require mutative reactive states, lifecycle management
 * or template slots
 *
 * @example
 * ### Using it in a Function/Object
 * ```ts
 * const MyDynamicComp = defineInlineComponent('<div class="box">Hello {{ name }}</div>')
 *
 *  // Pass it in an object
 *  const config = {
 *   label: 'User Card',
 *   component: MyDynamicComp
 *  }
 *
 *  // Pass it to a function
 *  registerPlugin(MyDynamicComp)
 * ```
 * @example
 * ### Using it in an SFC (Single File Component)
 * ```vue
 *  <script setup lang="ts">
 *  import { defineInlineComponent } from './ui'
 *
 *  // Define the component
 *  const InlineGreeting = defineInlineComponent('<p>Welcome, {{ user }}!</p>')
 *  </script>
 *
 *  <template>
 *  <section>
 *  <!-- Pass props directly like a normal component -->
 *  <InlineGreeting user="Alex" />
 *  </section>
 *  </template>
 * ```
 *
 * Because this returns a functional component, it is stateless.
 * If the `templateString` is later updated, this specific
 * instance won't "re-compile" automatically unless the parent
 * forces a re-render.
 *
 * The error saying "Runtime compilation is not supported",
 * can be fixed by adding this to `vite.config.js`:
 *
 * ```ts
 * export default defineConfig({
 *   // ...
 *   resolve: {
 *     alias: {
 *       vue: 'vue/dist/vue.esm-bundler.js',
 *     },
 *   },
 * });
 * ```
 * @returns The inline component definition.
 */
export function defineInlineComponent(templateString: string) {
  const renderFn = compile(templateString) as (props: unknown) => VNode
  return (props: unknown) => renderFn(props)
}
