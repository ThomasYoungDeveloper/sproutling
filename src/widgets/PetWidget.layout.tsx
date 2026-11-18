import { createWidget } from 'expo-widgets';
import { PetWidget, PET_WIDGET_INITIAL, type PetWidgetProps } from './PetWidget';

/**
 * Read only by the iPhone build step (app.json "initialLayout"), which needs the widget registered when the
 * file loads so it can bake in the widget's first look. The app itself never imports this file: it uses
 * makePetWidget(), which registers on first use where an error can't close the app.
 */
export default createWidget<PetWidgetProps>('PetWidget', PetWidget, PET_WIDGET_INITIAL);
