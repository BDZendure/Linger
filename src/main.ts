import { Plugin, MarkdownView } from 'obsidian';
import { EditorView, ViewPlugin, ViewUpdate, Decoration, DecorationSet } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import { LingerSettingTab, LingerSettings, DEFAULT_SETTINGS } from './settings';

interface SettlingRange {
  from: number;
  to: number;
  timestamp: number;
}

class SettlingViewPlugin {
  decorations: DecorationSet;
  settlingRanges: SettlingRange[];
  cleanupTimer: number | null;
  settings: LingerSettings;

  constructor(view: EditorView, settings: LingerSettings) {
    this.decorations = Decoration.none;
    this.settlingRanges = [];
    this.cleanupTimer = null;
    this.settings = settings;
    this.scheduleCleanup(view);
  }

  update(update: ViewUpdate) {
    const now = Date.now();
    
    // Always rebuild decorations to animate smoothly
    if (this.settlingRanges.length > 0) {
      this.decorations = this.buildDecorations(update.view, now);
    }
    
    // Process document changes (typing)
    if (update.docChanged) {
      // Add new ranges for changed text
      update.changes.iterChanges((fromA, toA, fromB, toB) => {
        // Only track insertions (when toB > fromB)
        if (toB > fromB) {
          this.settlingRanges.push({
            from: fromB,
            to: toB,
            timestamp: now
          });
        }
      });

      // Rebuild decorations
      this.decorations = this.buildDecorations(update.view, now);
      
      // Schedule cleanup
      this.scheduleCleanup(update.view);
    }
  }

  buildDecorations(view: EditorView, now: number): DecorationSet {
    const builder = new RangeSetBuilder<Decoration>();
    const isDark = this.isDarkMode(view);
    
    const totalDuration = this.settings.transitionDuration * 1000;
    
    // Filter out expired ranges and build decorations for active ones
    this.settlingRanges = this.settlingRanges.filter(range => {
      const age = now - range.timestamp;
      
      // Remove ranges older than total duration
      if (age > totalDuration) {
        return false;
      }
      
      // Calculate progress (0 = just typed, 1 = fully settled)
      const progress = Math.min(age / totalDuration, 1);
      
      const mark = this.createSettlingMark(isDark, progress);
      
      try {
        builder.add(range.from, range.to, mark);
      } catch (e) {
        // Range might be invalid after edits, skip it
        return false;
      }
      
      return true;
    });

    return builder.finish();
  }

  createSettlingMark(isDark: boolean, progress: number): Decoration {
    // Progress: 0 = just typed, 1 = fully settled to default color
    // Intensity: how much effect at progress 0
    const intensity = this.settings.intensity;
    
	//DARK MODE
    if (isDark) {
	  // start with lower brightness
      const minBrightness = 1 - intensity; // e.g., 0.6 if intensity is 0.4
      const brightness = minBrightness + (progress * intensity);
      
      return Decoration.mark({
        class: 'settling-text',
        attributes: {
          style: `filter: brightness(${brightness});`
        }
      });
	
	//LIGHT MODE
    } else {
      // start with lower opacity 
      const minOpacity = 1 - intensity; 
      const opacity = minOpacity + (progress * intensity);
      
      return Decoration.mark({
        class: 'settling-text',
        attributes: {
          style: `opacity: ${opacity};`
        }
      });
    }
  }

  isDarkMode(view: EditorView): boolean {
    // Check if body has dark theme class (standard Obsidian approach)
    return document.body.classList.contains('theme-dark');
  }

  scheduleCleanup(view: EditorView) {
    if (this.cleanupTimer !== null) {
      window.clearTimeout(this.cleanupTimer);
    }
    
    // Schedule frequent updates during transition for smooth animation (every 16ms ≈ 60fps)
    this.cleanupTimer = window.setTimeout(() => {
      const now = Date.now();
      this.decorations = this.buildDecorations(view, now);
      view.update([]);
      
      // Continue scheduling if there are still active ranges
      if (this.settlingRanges.length > 0) {
        this.scheduleCleanup(view);
      }
    }, 16);
  }

  updateSettings(settings: LingerSettings) {
    this.settings = settings;
  }

  destroy() {
    if (this.cleanupTimer !== null) {
      window.clearTimeout(this.cleanupTimer);
    }
  }
}

// Main Obsidian Plugin
export default class LingerPlugin extends Plugin {
  settings: LingerSettings;
  private editorExtension: any;

  async onload() {
    console.log('Loading Linger Plugin');
    
    // Load settings
    await this.loadSettings();
    
    // Register the CodeMirror 6 extension
    this.registerEditorExtensions();
    
    // Add settings tab
    this.addSettingTab(new LingerSettingTab(this.app, this));
    
    // Add minimal CSS for the settling effect
    this.addSettlingStyles();
  }

  registerEditorExtensions() {
    // Create the ViewPlugin with current settings
    this.editorExtension = ViewPlugin.fromClass(
      class extends SettlingViewPlugin {
        constructor(view: EditorView) {
          super(view, (view.state as any).facet?.(settingsField) || DEFAULT_SETTINGS);
        }
      },
      {
        decorations: v => v.decorations
      }
    );

    this.registerEditorExtension([this.editorExtension]);
  }

  addSettlingStyles() {
    // Add a style element for any additional styling needs
    const style = document.createElement('style');
    style.id = 'linger-styles';
    style.textContent = `
      /* Ensure settling text inherits theme colors */
      .settling-text {
        /* Transitions are handled inline for dynamic progress values */
      }
    `;
    document.head.appendChild(style);
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
    // Trigger a refresh of editor extensions
    this.app.workspace.updateOptions();
  }

  onunload() {
    console.log('Unloading Linger Plugin');
    
    // Clean up styles
    const style = document.getElementById('linger-styles');
    if (style) {
      style.remove();
    }
  }
}

// Settings field for accessing settings in ViewPlugin
import { Facet } from '@codemirror/state';
const settingsField = Facet.define<LingerSettings, LingerSettings>({
  combine: (values) => values[0] || DEFAULT_SETTINGS
});