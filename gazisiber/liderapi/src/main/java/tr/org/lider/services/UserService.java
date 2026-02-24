package tr.org.lider.services;

import java.util.ArrayList;
import java.util.List;

import org.apache.directory.api.ldap.model.message.SearchScope;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import tr.org.lider.entities.UserSessionImpl;
import tr.org.lider.ldap.LDAPServiceImpl;
import tr.org.lider.ldap.LdapEntry;
import tr.org.lider.repositories.AgentUserSessionRepository;
import tr.org.lider.security.User;

@Service
public class UserService implements UserDetailsService {
	
	@Autowired
	LDAPServiceImpl ldapService;
	
	@Autowired
	private ConfigurationService configurationService;
	
	@Autowired
	private AgentUserSessionRepository agentUserSessionRepository;
	

	public Page<UserSessionImpl> getUserSessions(int pageNumber, int pageSize, String userName) {
		PageRequest pageable = PageRequest.of(pageNumber - 1, pageSize, Sort.by("createDate").descending());
		
		return agentUserSessionRepository.findByUsername(userName, pageable);
	}
	
	@Override
	public User loadUserByUsername(String userName) throws UsernameNotFoundException {
		User user = null;
		LdapEntry ldapEntry = null;
		try {
			configurationService.destroyConfigParams();
			String filter= "(&(objectClass=pardusAccount)(objectClass=pardusLider)(liderPrivilege=ROLE_USER)(uid=$1))".replace("$1", userName);
			List<LdapEntry> ldapEntries  = ldapService.findSubEntries(filter,
					new String[] { "*" }, SearchScope.SUBTREE);
			
			if(ldapEntries.size()>0) {
				ldapEntry = ldapEntries.get(0);
			}
		} catch (Exception e) {
			e.printStackTrace();
		}
		
		if(ldapEntry!=null) {
			user = new User();
			user.setUsername(userName);
			user.setName(ldapEntry.getUid());
			user.setPassword(ldapEntry.getUserPassword());
			user.setSurname(ldapEntry.getSn());
			user.setDn(ldapEntry.getDistinguishedName());
			String[] priviliges = ldapEntry.getAttributesMultiValues().get("liderPrivilege");
			List<String> roles = new ArrayList<String>();
			for (int i = 0; i < priviliges.length; i++) {
				if(priviliges[i].startsWith("ROLE_")) {
					roles.add(priviliges[i]);
				}
			}
			user.setRoles(roles);
		}
		else {
			throw new UsernameNotFoundException("User Not Found . User :" + userName);
		}
		
		return user;
	}
}
