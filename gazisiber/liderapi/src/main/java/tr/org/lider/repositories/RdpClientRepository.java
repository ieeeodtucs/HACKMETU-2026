package tr.org.lider.repositories;

import tr.org.lider.entities.RdpClient;

public interface RdpClientRepository extends BaseJpaRepository<RdpClient, Long> {

    RdpClient findByHost(String host);

    RdpClient findByUsername(String username);

    RdpClient findByHostAndUsername(String host, String username);

    RdpClient findByHostname(String hostname);

}
