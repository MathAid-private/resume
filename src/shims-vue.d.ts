
declare module '*.css' {
  const classes: { [key: string]: string }
  export default classes
}
declare module '*.vue' {
    import type { DefineComponent } from 'vue'
    /* eslint-disable-next-line */
    const component: DefineComponent<{}, {}, any>
    export default component
}

export declare module 'vue' {
  import type { DefineComponent } from 'vue'
  /**extracted from [`IconifyJSON`](https://iconify.design/docs/types/iconify-json.html) icon set. */
  interface IconifyIconData {
    /**
     * contains contents of `<svg>`, without `<svg>` tag.
     *
     * It does not include `<svg>` tag because:
     * - Contents can be manipulated, such as rotating or flipping an icon. This is much easier to do when there is no need to parse an entire `<svg>`
     * - It gives components full control over `<svg>` tag, allowing addition/removal of custom attributes
     * - Makes it easy to use in various frameworks (such as React, Vue, Svelte), where `<svg>` element is created using framework's native code and content is set as its property
     */
    body: string
    /**Left position of viewBox. Default value is `0`.*/
    left?: number
    /**Top position of viewBox. Default value is `0`.*/
    top?: number
    /**Width of viewBox. Default value is `16`.*/
    width?: number
    /**Height of viewBox. Default value is `16`.*/
    height?: number
    /**Number of 90 degrees rotations. Default value is `0`*/
    rotate?: number
    /**Horizontal flip. Default value is `false`*/
    hFlip?: boolean
    /**Vertical flip. Default value is `false`*/
    vFlip?: boolean
  }
  interface IconifyIconProps {
    /**
     * The name of the icon vendor followed by a colon and the actual vendor-specific icon name e.g: `mdi:home` \
     * \
     * icon name or icon data. Because attributes can only be strings, if you want to provide [`IconifyIconData`](https://iconify.design/docs/types/iconify-icon.html)
     * data, you need to either use property or `JSON.stringify()` it. See [icon data](https://iconify.design/docs/iconify-icon/icon.html)
     */
    icon: IconifyIconData | string
    /**
     * As of version 2.0.0 of the web component, icons are rendered only when visible to the visitor.
     * For long documents with many icons, this improves the performance of pages by a lot.
     * As of version 2.1.0, you can opt out of this behavior by adding `noobserver` attribute to web component's HTML:
     *
     * @example
     * <iconify-icon icon="mdi:home" noobserver></iconify-icon>
     */
    noobserver?: boolean
    /**flip icon. See [icon transformations](https://iconify.design/docs/iconify-icon/transform.html)*/
    flip?: 'horizontal' | 'vertical' | 'horizontal,vertical'
    /**rotates icon. See [icon transformations](https://iconify.design/docs/iconify-icon/transform.html)*/
    rotate?: `${number}deg` | `${number}rad` | `${number}` | number
    /**icon width. See [icon dimensions](https://iconify.design/docs/iconify-icon/dimensions.html)*/
    width?: string | number
    /**icon height. See [icon dimensions](https://iconify.design/docs/iconify-icon/dimensions.html)*/
    height?: string | number
    /**changes vertical alignment. See [vertical alignment](https://iconify.design/docs/iconify-icon/inline.html)*/
    inline?: boolean
    /**sets icon rendering mode. See [rendering modes](https://iconify.design/docs/iconify-icon/modes.html)*/
    mode?: 'svg' | 'style' | 'mask' | 'bg' | 'mask'
  }
  interface GlobalComponents {
    /**
     * The [Iconify component](https://iconify.design/docs/icon-components/#process)
     */
    IconifyIcon: DefineComponent<IconifyIconProps>
  }
  interface GlobalDirectives {
    /**
     * Prevent pasting on elements (such as input and all whose `contenteditable` is set to true)
     *
     * @example
     * If no selector is given, then the element must be an input or have it's `contenteditable` attribute set to `true`
     * ```vue
     * <!-- Does not require a selector as it will auto-map to the input element -->
     * <input type="password" class="..." v-prevent-paste>
     * ```
     * If the directive value is a string, then it must be a valid css selector that selects an element that is an input or has it's `contenteditable` attribute set to `true`
     * ```vue
     * <!-- Requires a selector to map to the input element -->
     * <label for="pass" v-prevent-paste="'#pass'"> <input type="password" class="..." v-prevent-paste> </label>
     * ```
     * Or
     * ```vue
     * <!-- Requires a selector to map to the input element -->
     * <label for="pass" v-prevent-paste="{cssSelector: '#pass'}"> <input type="password" class="..." v-prevent-paste> </label>
     * ```
     */
    vPreventPaste;
    /**
     * Definition for the vue directive `v-tooltip="..."` which is implemented by primevue's tooltip component
     *
     * @example
     * ```vue
     * <script lang="ts" setup>
     * import { ref } from "vue";
     *
     * const reactiveValue = ref<string>('');
     * </script>
     *
     * <template>
     *   <div class="..." v-tooltip="reactiveValue">
     *       <!-- Children here -->
     *   </div>
     * </template>
     * ```
     */
    VTooltip
  }
}

export {};

declare global {
  /**
   * Extensions to the standard Web Navigator interface for runtime vendor detection.
   *
   * @remarks
   * These properties are highly environment-specific and non-standard.
   * Use caution as browsers may change, spoof, or deprecate these objects without notice.
   */
  interface Navigator {
    /**
     * Namespace injected by Chromium-based browsers, primarily Google Chrome and Opera.
     *
     * @remarks
     * Contains legacy application installation state APIs and internal runtime telemetry.
     */
    chrome?: {
      /**
       * Legacy Chrome Web Store app installation tracking object.
       */
      app: {
        /**
         * Checks if the companion web app is currently installed.
         */
        isInstalled: boolean;
        /**
         * Enumeration maps representing the installation state of the application.
         */
        InstallState: {
          /** Application is installed but manually disabled by the user. */
          DISABLED: string;
          /** Application is fully installed and active. */
          INSTALLED: string;
          /** Application has not been installed on the host system. */
          NOT_INSTALLED: string;
        };
        /**
         * Evaluates the active execution state of the background application.
         *
         * @returns A string indicating execution status (e.g., "running", "cannot_run").
         */
        runningState: () => string;
      };
      /**
       * Core Chromium background extension runtime bindings.
       */
      runtime: Record<string, unknown>;
      /**
       * Legacy performance monitoring API providing page load metric timestamps.
       *
       * @deprecated This non-standard API is deprecated in modern Chromium.
       * Use the standard {@link PerformanceNavigationTiming} API instead.
       *
       * @returns A key-value dictionary of high-resolution connection and paint time markers.
       */
      loadTimes?: () => Record<string, unknown>;
    };

    /**
     * Namespace injected exclusively by the Brave Browser environment.
     */
    brave?: {
      /**
       * Validates whether the executing user agent is genuinely Brave.
       *
       * @remarks
       * This method bypasses standard user-agent string spoofing checks.
       *
       * @returns A promise resolving to `true` if the host browser is Brave.
       */
      isBrave: () => Promise<boolean>;
    };

    /**
     * Legacy global marker found in older Presto-based versions of the Opera browser.
     *
     * @remarks
     * Historically used to detect Presto engine specific configurations or extensions.
     */
    opera?: string | Record<string, unknown>;

    /**
     * Vendor detection flag used exclusively by the Samsung Internet mobile browser.
     *
     * @defaultValue `true` (when running inside Samsung Internet)
     */
    samsungInk?: boolean;
  }

  /**
   * Extensions to the global Execution Context Window for vendor sniffing.
   */
  interface Window {
    /**
     * Reference to the Chromium vendor namespace.
     * @see {@link Navigator.chrome}
     */
    chrome?: Navigator['chrome'];
    /**
     * Reference to the legacy Opera vendor namespace.
     * @see {@link Navigator.opera}
     */
    opera?: Navigator['opera'];
    /**
     * Object namespace exposed on Apple Safari platforms.
     *
     * @remarks
     * Frequently used to verify if the executing tab is running under
     * Apple Desktop or Mobile WebKit environments.
     */
    safari?: Record<string, unknown>;
  }
}

