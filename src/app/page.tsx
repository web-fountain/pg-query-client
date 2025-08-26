import QueryWorkspace         from '@Components/QueryWorkspace';
import { SQLRunnerProvider }  from '@Components/providers/SQLRunnerProvider';


function Home() {
  return (
    <SQLRunnerProvider>
      <QueryWorkspace />
    </SQLRunnerProvider>
  );
}


export default Home;
