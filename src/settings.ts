import { App, PluginSettingTab, Setting } from "obsidian";
import LingerPlugin from "./main";

export interface LingerSettings {
	transitionDuration: number;     // seconds
	intensity: number;              // 0–1
}

export const DEFAULT_SETTINGS: LingerSettings = {
	transitionDuration: 1.5,
	intensity: 0.4,
};

export class LingerSettingTab extends PluginSettingTab {
	plugin: LingerPlugin;

	constructor(app: App, plugin: LingerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Transition Duration")
			.setDesc("Duration of the smooth transition to original text color (0.5 – 10 s)")
			.addSlider((slider) =>
				slider
					.setLimits(0.5, 10, 0.1)
					.setValue(this.plugin.settings.transitionDuration)
					.setDynamicTooltip()
					.onChange(async (val) => {
						this.plugin.settings.transitionDuration = val;
						await this.plugin.saveSettings();
					})
			);


		new Setting(containerEl)
			.setName("Intensity")
			.setDesc("How light the original text appears before settling (0 – 1)")
			.addSlider((slider) =>
				slider
					.setLimits(0, 1, 0.05)
					.setValue(this.plugin.settings.intensity)
					.setDynamicTooltip()
					.onChange(async (val) => {
						this.plugin.settings.intensity = val;
						await this.plugin.saveSettings();
					})
			);
	}
}
