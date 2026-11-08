import { bootstrapApplication, BootstrapContext } from '@angular/platform-browser';
import { AppComponent } from './app.component';

const bootstrap = (context: BootstrapContext) => bootstrapApplication(AppComponent, { providers: [] }, context);

export default bootstrap;
